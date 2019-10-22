import * as chrome from 'chrome-aws-lambda';
import * as puppeteer from 'puppeteer-core';
import * as axios from 'axios';
import * as allSettled from 'promise-all-settled';
import { decompress } from 'brotli';
import { httpResponse, getTechnologiesUsed } from '../../utils';

exports.handler = async (event, context) => {
  const domain = `${event.pathParameters.domain}`;
  try {
    const result = await getTechnologiesUsed(chrome, puppeteer, axios, allSettled, decompress, domain);
    global.console.log(result);
    return httpResponse(200, result);
  } catch(err) {
    console.log(err);
    return httpResponse(500);
  }
};