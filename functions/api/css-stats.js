import * as getCss from 'get-css';
import * as analyze from '@projectwallace/css-analyzer';
import * as axios from 'axios';
import { httpResponse, getCSSAnalysis } from '../../utils';

exports.handler = async (event, context) => {
  const domain = `${event.pathParameters.domain}`;
  try {
    const result = await getCSSAnalysis(getCss, analyze, axios, domain);
    global.console.log('css result', result);
    return httpResponse(200, result);
  } catch(err) {
    global.console.log('error', err);
    return httpResponse(500);
  }
};
