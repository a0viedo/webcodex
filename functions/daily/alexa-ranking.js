import * as axios from 'axios';
import { JSDOM } from 'jsdom';
import { format } from 'date-fns';
import { getAlexaRanking, getSNSPayload, updateDocument, getDateForToday } from '../../utils';

exports.handler = async function handler(event, context) {
  const { domain } = getSNSPayload(event);
  global.console.log(`getting alexa ranking for domain ${domain}`);
  const rank = await getAlexaRanking(axios, JSDOM, domain);
  await updateDocument(domain, getDateForToday(format), { alexaRank: rank });
};