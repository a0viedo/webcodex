import { httpResponse, getHTTPHeaders } from '../../utils';

exports.handler = async (event, context) => {
  const domain = `${event.pathParameters.domain}`;

  try {
    const result = await getHTTPHeaders(domain);
    return httpResponse(200, result);
  } catch(err) {
    console.log(err);
    return httpResponse(500);
  }
};