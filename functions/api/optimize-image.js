import * as fs from 'fs';
import * as imagemin from 'imagemin';
import * as imageminWebp from 'imagemin-webp';
import { httpResponse } from '../../utils';
import * as axios from 'axios';

exports.handler = async (event, context) => {
  const url = decodeURIComponent(event.queryStringParameters.url);
  try {
    global.console.log('url', url);
    const { data: streamResponse } = await axios({
      url,
      method: 'GET',
      responseType: 'stream'
    });

    const filename = Math.round(Math.random()*10e6);
    const fileStream = fs.createWriteStream(`/tmp/${filename}.png`);

    streamResponse.pipe(fileStream);

    const waitForDownload = function () {
      return new Promise((resolve, reject) => {
        fileStream.on('finish', () => {
          global.console.log('finished');
          resolve();
        });
        fileStream.on('error', () => {
          global.console.log('error');
          reject();
        });
      });
    };

    await waitForDownload();

    global.console.log('file downloaded');

    const files = await imagemin([`/tmp/${filename}.png`], {
      plugins: [
        imageminWebp({
          quality: Number(process.env.IMAGE_QUALITY),
          crop: {
            x: 0,
            y: 0,
            width: Number(process.env.IMAGE_WIDTH),
            height: Number(process.env.IMAGE_HEIGHT)
          }
        })
      ]
    });

    global.console.log('conversion finished', files);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'image/webp' },
      body: files[0].data.toString('base64'),
      isBase64Encoded: true
    };
  } catch(err) {
    global.console.log('error', err);
    return httpResponse(500);
  }
};
