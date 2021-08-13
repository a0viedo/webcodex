import { spawn } from 'child_process';
import * as AWS from 'aws-sdk';
import * as url from 'url';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';

const fsUnlink = util.promisify(fs.unlink);
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS({});

export async function getFromDatabase(query) {
  global.console.log(`table: ${process.env.AWS_DYNAMODB_TABLE}`);
  global.console.log('query', query);
  const params = {
    TableName: process.env.AWS_DYNAMODB_TABLE,
    Key: query
  };

  const { Item } = await dynamoDb.get(params).promise();
  return Item;
}

export async function getFromDatabaseBetween(query) {
  if(!query.domain) {
    return exports.scanDatabase(query);
  }
  const params = {
    TableName: process.env.AWS_DYNAMODB_TABLE,
    KeyConditionExpression: '#primaryKey = :domain AND #sortKey BETWEEN :from AND :to',
    ExpressionAttributeNames: {
      '#sortKey': 'date',
      '#primaryKey': 'domain'
    },
    ExpressionAttributeValues: {
      ':domain': query.domain,
      ':from': query.from,
      ':to': query.to
    }
  };

  const result = await dynamoDb.query(params).promise();
  console.log(result);
  return result.Items;
}

export async function scanDatabase2({ date, exclusiveStartKey }) {
  const params = {
    TableName: process.env.AWS_DYNAMODB_TABLE,
    FilterExpression: '#sortKey = :date',
    ExclusiveStartKey: exclusiveStartKey,
    ExpressionAttributeNames: {
      '#sortKey': 'date',
    },
    ExpressionAttributeValues: { ':date': date }
  };

  const result = await dynamoDb.scan(params).promise();
  if(result.LastEvaluatedKey) {
    return result.Items.concat(await exports.scanDatabase2({
      date,
      exclusiveStartKey: result.LastEvaluatedKey
    }));
  }
  return result.Items;
}

export async function scanDatabase({ from, to, exclusiveStartKey = null }) {
  const params = {
    TableName: process.env.AWS_DYNAMODB_TABLE,
    FilterExpression: '#sortKey BETWEEN :from AND :to',
    ExclusiveStartKey: exclusiveStartKey,
    ExpressionAttributeNames: {
      '#sortKey': 'date',
    },
    ExpressionAttributeValues: { ':from': from, ':to': to }
  };

  const result = await dynamoDb.scan(params).promise();
  console.log('items', result.Items.length);
  if(result.LastEvaluatedKey) {
    return result.Items.concat(await exports.scanDatabase({
      from,
      to,
      exclusiveStartKey: result.LastEvaluatedKey
    }));
  }
  return result.Items;
}

export async function sendSNSMessage(params) {
  console.log('sending SNS message', params);
  return sns.publish(params).promise();
}

export function getSNSPayload(event){
  return JSON.parse(event.Records[0].Sns.Message);
}

export async function updateDocument(domain, date, document) {
  const params = {
    TableName: process.env.AWS_DYNAMODB_TABLE,
    Key: {
      domain,
      date
    },
    ReturnValues: 'ALL_NEW',
    UpdateExpression: 'set ',
    ExpressionAttributeValues: {}
  };

  for(const [key, value] of Object.entries(document)) {
    params.UpdateExpression += `${key} = :${key},`;
    params.ExpressionAttributeValues[`:${key}`] = value;
  }

  params.UpdateExpression = params.UpdateExpression.slice(0, -1);
  console.log('params', params);
  await dynamoDb.update(params).promise();
}

export function getDateForToday(formatFn) {
  return formatFn(new Date(), 'YYYY-MM-DD');
}

export function domainToURL(domain) {
  const decodedDomain = decodeURIComponent(domain);
  return decodedDomain.includes('https://') ? decodedDomain : `https://${decodedDomain}`;
}

export function httpResponse(statusCode, body, stringify) {
  const response = {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    }
  };

  if(body) {
    if(stringify) {
      response.body = stringify(body);
    } else {
      response.body = JSON.stringify(body);
    }
  }

  return response;
}

export async function getAlexaRanking(axios, JSDOM, domain) {
  // TODO: this URL should be an environment variable
  const { data: html } = await axios.get(`https://www.alexa.com/siteinfo/${domain}`);
  const dom = new JSDOM(html);
  const domElement = dom.window.document.querySelector(process.env.ALEXA_RANK_DOM_SELECTOR);
  if(!domElement) {
    throw new Error(`no element found for selector ${process.env.ALEXA_RANK_DOM_SELECTOR}`);
  }
  const rank = domElement.textContent.trim().replace('#', '');
  return rank;
}

export async function getHTTPHeaders(domain) {
  const curlOutput = await runCommand(`curl -A "${process.env.USER_AGENT}" -sSL -D - ${domain} -o /dev/null`);

  if(!curlOutput) {
    throw new Error('empty curl output');
  }

  console.log('curlOutput', curlOutput);
  const result = formatCurlOutput(curlOutput);
  console.log(result);

  return result;
}

export async function runCommand(cmd) {
  const p = spawn('sh', ['-c', cmd]);
  let cmdOutput = '';
  p.stdout.setEncoding('utf8');
  p.stdout.on('data', (data) => {
    cmdOutput += data;
  });
  await new Promise(resolve => p.on('exit', resolve));
  return cmdOutput;
}

export async function getCurlData(domain) {
  // TODO: this path should be an environment variable
  const curlOutput = await runCommand(`curl -w "@/opt/nodejs/curl-format.json" -o /dev/null -s ${domainToURL(domain)}`);

  global.console.log('output', curlOutput);
  if(curlOutput === '') {
    throw new Error('empty output from cURL');
  }

  return JSON.parse(curlOutput);
}

export async function getCSSAnalysis(getCss, analyze, axios, domain) {
  let css;
  try {
    const result = await new Promise(async (resolve, reject) => {
      let resolved = false;
      setTimeout(() => {
        if(resolved) {
          return;
        }
        reject(Error(`it didn't finished`));
      }, Number(process.env.TIMEOUT));

      // for some reason this timeout is not working, we need to enforce it
      const result = await getCss(domainToURL(domain), { timeout: Number(process.env.TIMEOUT) });
      resolved = true;
      resolve(result);
    });
    css = result.css;
  } catch(err) {
    console.log('there was an error', err);
    console.log('trying to get the css with curl');
    css = await getCSSUsingCurl(axios, domainToURL(domain));
  } finally {
    const result = await analyze(css);
    var reducedResult = { };

    // sort for frequency and get top 5 for each stat
    for(const [key, value] of Object.entries(result)) {
      if(Array.isArray(value)) {
        if(value.length !== 0) {
          reducedResult[key] = value.sort((a,b) => {
            if(a.count < b.count){
              return 1;
            }
            return -1;
          }).slice(0, 5);
        }
      } else {
        reducedResult[key] = value;
      }
    }
  
    return reducedResult;
  }
}

// TODO: update curl-headers-to-json package to export a method and use that
function formatCurlOutput(data) {
  let parts = data.split('HTTP/1.1 200 OK\r\n');
  if(parts.length === 1) {
    parts = data.split('HTTP/2 200');
  }
  console.log('parts', parts);
  const lines = parts[1].split(/\r?\n|\r/g);
  const result = {};
  for(let line of lines) {
    if(line.trim() === '') {
      continue;
    }
    const [key, value] = line.split(': ');
    result[key] = value.replace(/\\r/g, '');
  }
  return result;
}

export async function getHTMLAnalysis(getCss, JSDOM, domain) {
  let html;
  try {
    const result = await new Promise(async (resolve, reject) => {
      let resolved = false;
      setTimeout(() => {
        if(resolved) {
          return;
        }
        reject(Error(`it didn't finished`));
      }, Number(process.env.TIMEOUT));

      // for some reason this timeout is not working, we need to enforce it
      const result = await getCss(domainToURL(domain), { timeout: Number(process.env.TIMEOUT) });
      resolved = true;
      resolve(result);
    });
    html = result.html;
  } catch(err) {
    console.log('there was an error', err);
    console.log('trying to get the html using curl');
    html = await getHTMLUsingCurl(domainToURL(domain));
  } finally {
    global.console.log('got html');
    const dom = new JSDOM(html);
    const result = {attributes: {}};
    global.console.log('started traversing');
    traverseHTMLNode(dom.window.document.body, result);
    global.console.log('finished traversing');
    return result;
  }
}

function traverseHTMLNode(node, result){
  if(node.children && node.children.length !== 0){
    for(const child of node.children) {
      traverseHTMLNode(child, result);
    }
  }

  const tagName = node.tagName.toLowerCase();

  if(!result[tagName]) {
    result[tagName] = {
      count: 1,
      attributes: {}
    };

    // if(node.attributes && node.attributes.length !== 0) {
    //   for(const { name } of node.attributes) {
    //     result[tagName].attributes[name] = 1;
    //     if(!result.attributes[name]) {
    //       result.attributes[name] = 1;
    //     } else {
    //       result.attributes[name]++;
    //     }
    //   }
    // }
  } else {
    result[tagName].count++;
  }

  if(node.attributes && node.attributes.length !== 0) {
    for(const { name } of node.attributes) {
      if(!result[tagName].attributes[name]) {
        result[tagName].attributes[name] = 1;
      } else {
        result[tagName].attributes[name]++;
      }
      if(!result.attributes[name]) {
        result.attributes[name] = 1;
      } else {
        result.attributes[name]++;
      }
    }
  }
}

function allCharsAreEqual(color) {
  return color[1] === color[2] && color[2] === color[3] && color[3] === color[4] && color[4] === color[5];
}
function relativePathToAbsolute(input, domain) {
  if(input[0] === '/') {
    if(input.substr(0, 2) === '//') {
      return `https:${input}`;
    } else {
      return `https://${url.parse(domain).host}${input}`;
    }
  } else if(input.substr(0, 4) !== 'http') {
    return `https://${url.parse(domain).host}/${input}`;
  } else {
    return input;
  }
}

async function getCSSUsingCurl(axios, domain){
  const links = await runCommand(`curl '${domain}' -L ${process.env.CURL_PARAMS} 2> /dev/null | grep stylesheet`);
  const regex = /href=(["'])(.*?)\1/g;
  let match;
  const hrefs = [];
  while (match = regex.exec(links)) {
    hrefs.push(match[2]);
  }

  const results = await Promise.all(hrefs.map(href => axios.get(relativePathToAbsolute(href, domain))));
  return results.map(x => x.data).join('');
}

function getHTMLUsingCurl(domain){
  return runCommand(`curl '${domain}' -L ${process.env.CURL_PARAMS} 2> /dev/null`);
}

export async function getColorBar(getCss, colorSort, domain, axios, allSettled, width) {
  let css;
  try {

    // TODO: remove these headers as are usually uneffective against CDNs and bloat the function...
    const { css: cssResponse, links} = await getCss(domainToURL(domain), {
      headers: {
        authority: 'codepen.io',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
        'accept-language': 'en-US,en;q=0.9,es-419;q=0.8,es;q=0.7,gl;q=0.6',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
        dnt: 1,
        'sec-ch-ua': 'Google Chrome 77',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'sec-origin-policy': '0',
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36',
        'accept-encoding': 'gzip, deflate'
      },
      timeout: process.env.TIMEOUT
    });
    css = cssResponse;
    if(css === '' && links.length !== 0) {
      const responses = await allSettled(links.map(link => axios.get(link.url)));
      const cssContent = responses.filter(x=> x.state === 'fulfilled').map(x => x.result.data).join('');
      css = cssContent;
    }
    console.log('css', css);
  } catch(err) {
    console.log('there was an error', err);
    console.log('trying to get the css with curl');
    css = await getCSSUsingCurl(axios, domainToURL(domain));
  } finally {
    const matches = css.match(/(#([\da-f]{3}){1,2}|(rgb|hsl)a\((\d{1,3}%?,\s?){3}(1|0?\.\d+)\)|(rgb|hsl)\(\d{1,3}%?(,\s?\d{1,3}%?){2}\))/ig);
    if(!matches) {
      console.log('there were no matches, which is super weird friend');

      // TODO: try with curl, there's no way this is can be empty
      return [];
    }

    global.console.log('matches', matches.length);
    const result = [...countColorsFrequency(matches)];

    global.console.log('colors frequency', result);

    if(result && result.length === 0) {
      return [];
    }

    const sorted = colorSort(result.map(x => x.color));
    return sorted;
  }
}

function countColorsFrequency(colors) {
  const map = {};
  colors.forEach(color => {
    let normalized;

    if(color.startsWith('rgb') || color.startsWith('hsl')) {
      normalized = color.replace(/ /g, '');
    } else if(color.length === 4) {
      normalized = threeDigitHexaToSixDigit(color).toUpperCase();
    } else {
      normalized = color.toUpperCase();
    }

    if(map[normalized]) {
      map[normalized]++;
    } else {
      map[normalized] = 1;
    }
  });

  return Object.entries(map).map(([key, value]) => ({ color: key, count: value }));
}

function threeDigitHexaToSixDigit(color) {
  return `#${color[1].repeat(2)}${color[2].repeat(2)}${color[3].repeat(2)}`;
}

export async function getTechnologiesUsed(chrome, puppeteer, axios, allSettled, decompress, domain) {
  console.log('technologies used', domain);
  const browser = await puppeteer.launch({
    args: chrome.args,
    defaultViewport: chrome.defaultViewport,
    executablePath: await chrome.executablePath,
    headless: chrome.headless,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(process.env.USER_AGENT);
  await page.goto(domainToURL(domain), {
    waitUntil: process.env.PUPPETEER_WAIT_UNTIL_EVENT,
  });

  global.console.log('loaded domain', domain);
  if(process.env.PUPPETEER_WAIT_FOR_MILLISECONDS) {
    await page.waitFor(Number(process.env.PUPPETEER_WAIT_FOR_MILLISECONDS));
  }

  const scripts = await page.evaluate(domain => {
    const result = [];
    const elements = document.getElementsByTagName('script');
    for(const script of elements) {
      if(!script.attributes.src) {
        continue;
      }
      result.push(script.src);
    }

    const links = document.getElementsByTagName('links');
    for(const link of links) {
      if(link.rel && link.href && link.rel === 'preload' && link.href.match(/\.js/)) {
        result.push(link.href);
      }
    }
    return result;
  }, domain);

  global.console.log('scripts', scripts);

  const scriptResults = await allSettled(scripts.map(script => {

    // TODO: axios won't be able to get some resources on CDNs
    return axios.get(script, {
      responseType: 'arraybuffer',
      timeout: 5000
    });
  }));

  console.log('finished downloading scripts');
  const scriptContents = scriptResults.filter(x=> x.state === 'fulfilled').map(({ result: response })=> {
    if(response.headers['content-encoding'] === 'br') {
      console.log('decompressing brotli file');
      return Buffer.from(decompress(response.data)).toString();
    } else if(response.headers['content-encoding'] === 'gzip') {
      console.log('gzipped script');
      return response.data;
    }
    return Buffer.from(response.data).toString();
  });
  // TODO: investigate why some scripts would fail
  scriptResults.filter(x=> x.state === 'rejected').forEach(e => console.log('script failed', e.error));
  const mergedJavaScriptFiles = scriptContents.join('');
  const technologiesConfigured = process.env.TECHNOLOGIES.split(',');
  const technologies = [];

  for(const tech of technologiesConfigured) {
    const identifiers = process.env[`${tech}_IDENTIFIERS`].split(',');
    for(const identifier of identifiers) {
      const match = mergedJavaScriptFiles.match(new RegExp(identifier));
      if(match) {
        technologies.push(mapTechnologyNames(tech));
        break;
      }
    }
  }
  console.log(`the domain ${(domain)} is using:`, technologies);

  await page.close();
  await browser.close();
  return technologies;
}

function mapTechnologyNames(str) {
  switch (str) {
    case 'REACTJS':
      return 'React.js';
    case 'VUEJS':
      return 'Vue.js';
    case 'VUEX':
      return 'Vuex';
    case 'ANGULAR':
      return 'Angular';
    case 'SIZZLE':
      return 'Sizzle.js';
    case 'JQUERY':
      return 'jQuery.js';
    case 'LODASH':
      return 'lodash';
    case 'PREACT':
      return 'Preact';
    case 'WEBPACK':
      return 'Webpack';
    case 'REQUIREJS':
      return 'Require.js';
    case 'REDUX':
      return 'Redux';
    case 'MOMENTJS':
      return 'Moment.js';
    case 'REACTROUTER':
      return 'react-router';
    case 'VUEROUTER':
      return 'vue-router';
    case 'NEXTJS':
      return 'Next.js';
    case 'NUXTJS':
      return 'Nuxt.js';
    default:
      return str.toLowerCase();
  }
}

export async function getLighthouse2(chromeLauncher, chrome, lighthouse, domain) {
  const chromeInstance = await chromeLauncher.launch({
    chromeFlags: [...chrome.args, '--disable-web-security', '--disable-gpu', '--headless', '--single-process'],
    chromePath: await chrome.executablePath,
    logLevel: 'verbose'
  });

  console.log('chromeInstance', chromeInstance);

  const lighthouseConfig = {
    extends: 'lighthouse:default',
    settings: {
      onlyCategories: ['performance', 'accessibility', 'pwa', 'accessibility', 'seo', 'best-practices']
    }
  };

  const { lhr } = await lighthouse(domainToURL(domain), { port: chromeInstance.port }, lighthouseConfig);

  return lhr;
}

export async function uploadToS3(bucket, filename, content) {

  const s3bucket = new AWS.S3({params: {Bucket: bucket}});
  const params = {
    Key: filename,
    Body: content
  };

  switch(path.extname(filename)) {
    case '.png':
      params.ContentType = 'image/png';
      break;
    case '.jpg':
    case '.jpeg':
      params.ContentType = 'image/jpg';
      break;

    case '.webp':
      params.ContentType = 'image/webp';
      break;

    default:
  }
  return s3bucket.upload(params).promise();
}

export async function uploadGist(axios, description, content) {
  const { data: result } = await axios.post(process.env.GH_GISTS_URL, {
    description,
    public: false,
    files: {
      'report.json': { content }}
  }, {
    headers: {
      Authorization: `Token ${process.env.GH_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  return {
    url: result.url,
    id: result.id
  };
}

export function getMD5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

export async function getColorDetection(chromeLauncher, chrome, puppeteer, axios, domain) {
  const lsResult = await runCommand('df -k /tmp ; ls -al /tmp');
  console.log(lsResult);

  let chromeInstance;
  try {
    chromeInstance = await chromeLauncher.launch({
      chromeFlags: [...chrome.args, '--disable-web-security', '--disable-gpu', '--headless', '--single-process'],
      chromePath: await chrome.executablePath,
      logLevel: 'verbose'
    });

    console.log('launched chrome instance', chromeInstance);

    const { data: chromeInstanceJSON } = await axios.get(`http://localhost:${chromeInstance.port}/json/version`);
    const browser = await puppeteer.connect({browserWSEndpoint: chromeInstanceJSON.webSocketDebuggerUrl});

    console.log('connected puppeteer to chrome. launching new page...');
    const page = await browser.newPage();

    // TODO: debate if viewport should be this or not
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(process.env.USER_AGENT);

    console.log(`browsing to ${domain}`);
    await page.goto(domainToURL(domain), {
      waitUntil: process.env.PUPPETEER_WAIT_UNTIL_EVENT,
      timeout: 0
    });

    if(process.env.PUPPETEER_WAIT_FOR_MILLISECONDS) {
      await page.waitFor(Number(process.env.PUPPETEER_WAIT_FOR_MILLISECONDS));
    }

    const screenshotPath = `/tmp/${getMD5(domain)}.png`;
    await page.screenshot({path: screenshotPath, fullPage: true });

    console.log('screenshot taken');
    const convertOutput = await runCommand(`convert /tmp/${getMD5(domain)}.png -scale 50x50! -depth 8 +dither -colors 8 -format "%c" histogram:info: | sed -n 's/^[ ]*\\(.*\\):.*[#]\\([0-9a-fA-F]*\\) .*$/\\1,#\\2/p' | sort -r -n -k 1 -t ","`);

    console.log('convert output', convertOutput);
    const lines = convertOutput.split(/\r?\n|\r/g);
    const result = {
      screenshotPath,
      colors: []
    };

    for(const line of lines) {
      if(line.trim() === '') {
        continue;
      }
      const [count, color] = line.split(',');
      result.colors.push({ count, color });
    }

    console.log('closing chrome and cleaning up...');
    await page.close();
    await browser.close();

    // why is this needed? browser.close supposedly finished...why?
    process.nextTick(() => chromeInstance.kill());
    return result;
  } catch(err) {
    console.log('there was an error while trying to run puppeteer');
    console.log(err);
    process.nextTick(() => {
      if(chromeInstance) {
        chromeInstance.kill();
      }
    });
    throw err;
  }
}

export async function getLatestScreenshot(domain) {
  return `${process.env.SCREENSHOT_BUCKET_URL}/${getMD5(domain)}.${process.env.SCREENSHOT_EXTENSION}`;
}

export function deleteFile(filePath) {
  return fsUnlink(filePath);
}

export async function optimizeImage(imagemin, imageminWebp, filePath) {
  const { 0: result } = await imagemin([filePath], {
    plugins: [
      imageminWebp({
        quality: Number(process.env.IMAGE_QUALITY),
        crop: {
          x: 0,
          y: 0,
          width: Number(process.env.IMAGE_WIDTH),
          height: Number(process.env.IMAGE_HEIGHT)
        }
      })
    ]
  });
  return result;
}
