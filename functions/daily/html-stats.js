import * as getCss from 'get-css';
import { JSDOM } from 'jsdom';
import { format } from 'date-fns';
import { getHTMLAnalysis, getSNSPayload, updateDocument, getDateForToday } from '../../utils';

exports.handler = async function (event, context) {
  const { domain } = await getSNSPayload(event);
  global.console.log(`getting html stats for domain ${domain}`);
  const result = await getHTMLAnalysis(getCss, JSDOM, domain);
  await updateDocument(domain, getDateForToday(format), {
    htmlStats: result
  });
};