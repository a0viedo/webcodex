import * as chromeLauncher from 'chrome-launcher';
import * as chrome from 'chrome-aws-lambda';
import * as lighthouse from 'lighthouse';
import * as axios from 'axios';
import { getLighthouse2, updateDocument, getSNSPayload, getDateForToday, uploadGist } from '../../utils';
import { format } from 'date-fns';

global.URL = global.URL || require('whatwg-url').URL;

exports.handler = async function (event, context) {
  const { domain } = await getSNSPayload(event);
  global.console.log(`getting lighthouse report for domain ${domain}`);
  const result = await getLighthouse2(chromeLauncher, chrome, lighthouse, domain);
  console.log('result', result);
  const { id, url } = await uploadGist(axios, `Report generated for ${domain} on ${getDateForToday(format)}`, JSON.stringify(result));

  const lighthouseResults = {
    categories: {
      performance: result.categories.performance.score,
      pwa: result.categories.pwa.score,
      accessibility: result.categories.accessibility.score,
      seo: result.categories.seo.score,
      'best-practices': result.categories['best-practices'].score
    },
    audits: {
      'first-contentful-paint': result.audits['first-contentful-paint'].numericValue,
      'time-to-interactive': result.audits.interactive.numericValue,
      'first-cpu-idle': result.audits['first-cpu-idle'].numericValue,
      'first-meaningful-paint': result.audits['first-meaningful-paint'].numericValue,
      'time-to-first-byte': result.audits['time-to-first-byte'].numericValue
    }
  };
  await updateDocument(domain, getDateForToday(format), {
    lighthouse: lighthouseResults,
    lighthouseReportURL: url,
    lighthouseViewReportURL: `${process.env.LIGHTHOUSE_REPORT_VIEWER_URL}${id}`
  });
};