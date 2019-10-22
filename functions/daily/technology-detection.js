import * as chrome from 'chrome-aws-lambda';
import * as puppeteer from 'puppeteer-core';
import * as axios from 'axios';
import * as allSettled from 'promise-all-settled';
import { format } from 'date-fns';
import { decompress } from 'brotli';
import { getTechnologiesUsed, updateDocument, getSNSPayload, getDateForToday } from '../../utils';

exports.handler = async function (event, context) {
  const { domain } = await getSNSPayload(event);
  global.console.log(`getting technologies for domain ${domain}`);
  const technologies = await getTechnologiesUsed(chrome, puppeteer, axios, allSettled, decompress, domain);
  await updateDocument(domain, getDateForToday(format), {
    technologies
  });
};