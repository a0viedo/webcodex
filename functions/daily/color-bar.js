import * as getCss from 'get-css';
import * as colorSort from 'color-sorter';
import * as axios from 'axios';
import * as allSettled from 'promise-all-settled';
import { format } from 'date-fns';
import { getColorBar, getSNSPayload, updateDocument, getDateForToday } from '../../utils';

exports.handler = async function handler(event, context) {
  const { domain } = getSNSPayload(event);
  global.console.log(`getting color bar for domain ${domain}`);
  const svg = await getColorBar(getCss, colorSort, domain, axios, allSettled, event.queryStringParameters && event.queryStringParameters.width);
  await updateDocument(domain, getDateForToday(format), {
    colorBar: svg
  });
};