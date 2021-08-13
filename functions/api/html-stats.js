import * as getCss from 'get-css';
import { JSDOM } from 'jsdom';
import { httpResponse, getHTMLAnalysis } from '../../utils';
import fs from 'fs';

exports.handler = async (event, context) => {
  const domain = decodeURIComponent(event.pathParameters.domain);
  global.console.log('domain', domain);
  try {
    console.log('content of /usr/lib64');
    console.log(fs.readdirSync("/usr/lib64").filter(p => p.match(/\.so/)).sort().join("\n"));
    const result = await getHTMLAnalysis(getCss, JSDOM, domain);
    global.console.log('html result', result);
    return httpResponse(200, result);
  } catch(err) {
    global.console.log('error', err);
    return httpResponse(500);
  }
};