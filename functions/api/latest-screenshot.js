import { httpResponse, getLatestScreenshot } from '../../utils';

exports.handler = async (event, context) => {
  const domain = event.pathParameters.domain;
  try {
    const url = await getLatestScreenshot(domain);
    return httpResponse(200, url);
  } catch(err) {
    global.console.log(err);
    return httpResponse(500);
  }
};