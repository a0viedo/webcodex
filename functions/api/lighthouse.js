import * as chromeLauncher from 'chrome-launcher';
import * as chrome from 'chrome-aws-lambda';
import * as lighthouse from 'lighthouse';
import { format } from 'date-fns';
import * as axios from 'axios';
import { httpResponse, getLighthouse2, uploadGist, getDateForToday } from '../../utils';
global.URL = global.URL || require('whatwg-url').URL;

exports.handler = async (event, context) => {
  const domain = `${event.pathParameters.domain}`;

  try {
    const result = await getLighthouse2(chromeLauncher, chrome, lighthouse, domain);
    console.log('result', result);
    const { id } = await uploadGist(axios, `Report generated for ${domain} on ${getDateForToday(format)}`, JSON.stringify(result));
    return httpResponse(200, {
      lighthouse: result,
      viewReportURL: `${process.env.LIGHTHOUSE_REPORT_VIEWER_URL}${id}`
    });
  } catch(err) {
    console.log(err);
    return httpResponse(500);
  }
};
