import * as getCss from 'get-css';
import * as colorSort from 'color-sorter';
import * as axios from 'axios';
import * as allSettled from 'promise-all-settled';
import { httpResponse, getColorBar } from '../../utils';

exports.handler = async (event, context) => {
  const domain = `${event.pathParameters.domain}`;
  try {
    console.log(`getting color bar for domain ${domain}`);
    const svg = await getColorBar(getCss, colorSort, domain, axios, allSettled, event.queryStringParameters && event.queryStringParameters.width);
    return httpResponse(200, svg);
  } catch(err) {
    console.log(err);
    return httpResponse(500);
  }
};