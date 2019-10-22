import { httpResponse, getAlexaRanking } from '../../utils';
import * as axios from 'axios';
import { JSDOM } from 'jsdom';
exports.handler = async (event, context) => {
  const domain = `${event.pathParameters.domain}`;
  global.console.log(`getting alexa ranking 2 for domain ${domain}`);
  try {
    const rank = await getAlexaRanking(axios, JSDOM, domain);
    return httpResponse(200, {
      alexaRank: rank
    });
  } catch(err) {
    global.console.log(err);
    return httpResponse(500);
  }
};