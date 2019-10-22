import * as getCss from 'get-css';
import * as analyze from '@projectwallace/css-analyzer';
import { getCSSAnalysis, updateDocument, getDateForToday, getSNSPayload } from '../../utils';
import { format } from 'date-fns';
import * as axios from 'axios';

exports.handler = async function handler(event, context) {
  const { domain } = getSNSPayload(event);
  global.console.log(`getting css stats for domain ${domain}`);

  const result = await getCSSAnalysis(getCss, analyze, axios, domain);
  await updateDocument(domain, getDateForToday(format), {
    cssStats: result
  });
};