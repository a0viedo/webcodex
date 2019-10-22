import * as chromeLauncher from 'chrome-launcher';
import * as chrome from 'chrome-aws-lambda';
import * as puppeteer from 'puppeteer-core';
import { httpResponse, getColorDetection, uploadToS3, getDateForToday, deleteFile } from '../../utils';
import { readFile as readFileCallback } from 'fs';
import { promisify } from 'util';
import {format} from 'date-fns';
import * as axios from 'axios';

const readFile = promisify(readFileCallback);

exports.handler = async (event, context) => {
  const domain = `${event.pathParameters.domain}`;
  console.log('domain', domain);
  try {
    const { colors, screenshotPath } = await getColorDetection(chromeLauncher, chrome, puppeteer, axios, domain);
    console.log('colors', colors);
    console.log(screenshotPath);

    const { 0: { Location } } = await Promise.all([
      uploadToS3(process.env.S3_SCREENSHOT_BUCKET, `${encodeURIComponent(domain)}/${getDateForToday(format)}.png`, await readFile(screenshotPath)),
    ]);
    console.log('Location', Location);

    await deleteFile(screenshotPath);
    return httpResponse(200, {
      colors,
      screenshotURL: Location
    });

  } catch (error) {
    console.log(error);
    return httpResponse(500);
  }
};
