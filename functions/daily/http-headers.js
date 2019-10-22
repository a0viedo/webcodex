import { getHTTPHeaders, updateDocument, getSNSPayload, getDateForToday } from '../../utils';
import { format } from 'date-fns';

exports.handler = async function (event, context) {
  const { domain } = await getSNSPayload(event);
  global.console.log(`getting http headers for domain ${domain}`);
  const result = await getHTTPHeaders(domain);
  await updateDocument(domain, getDateForToday(format), {
    httpHeaders: result
  });
};