import * as chromeLauncher from 'chrome-launcher';
import * as chrome from 'chrome-aws-lambda';
import * as puppeteer from 'puppeteer-core';
import * as axios from 'axios';
import { readFile as readFileCallback } from 'fs';
import { promisify } from 'util';
import {format} from 'date-fns';
import { getColorDetection2, getSNSPayload, updateDocument, getDateForToday, uploadToS3, getMD5, runCommand } from '../../utils';
const readFile = promisify(readFileCallback);

exports.handler = async (event, context) => {
  const { domain } = await getSNSPayload(event);

  try {
    const { colors, screenshotPath } = await getColorDetection2(chromeLauncher, chrome, puppeteer, axios, domain);
    console.log('colors', colors);
    console.log(screenshotPath);
    const date = getDateForToday(format);
    const file = await readFile(screenshotPath);
    const [{ Location }] = await Promise.all([
      await uploadToS3(process.env.S3_SCREENSHOT_BUCKET, `${encodeURIComponent(domain)}/${date}.png`, file),
      await uploadToS3(process.env.S3_SCREENSHOT_BUCKET, `${getMD5(domain)}.png`, file)
    ]);
    console.log('Location', Location);
    await Promise.all([
      updateDocument(domain, date, {
        colorCount: colors,
        screenshotURL: Location
      }),
      runCommand('rm -r /tmp/*')
    ]);
  } catch (error) {
    console.log(error);
  }
};