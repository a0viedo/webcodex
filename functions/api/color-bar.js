import * as getCss from 'get-css';
import * as colorSort from 'color-sorter';
import * as axios from 'axios';
import * as allSettled from 'promise-all-settled';
import { httpResponse, getColorBar } from '../../utils';
// const httpResponse = () => {};


exports.handler = async (event, context) => {
  // console.dir(event, {depth: 7});
  const domain = `${event.pathParameters.domain}`;
  // const domain = 'https://auth0.com';

  try {
    global.console.log(`getting color bar for domain ${domain}`);



    // transform transform="rotate(8, ${x}, 0)"
    const svg = await getColorBar(getCss, colorSort, domain, axios, allSettled, event.queryStringParameters && event.queryStringParameters.width);
    return httpResponse(200, svg);
  } catch(err) {
    console.log(err);
    return httpResponse(500);
  }
};

// function threeDigitHexaToSixDigit(color) {
//   return `#${color[1].repeat(2)}${color[2].repeat(2)}${color[3].repeat(2)}`;
// }

// function countColorsFrequency(colors) {
//   const map = {};
//   colors.forEach(color => {
//     let normalized;

//     if(color.startsWith('rgb') || color.startsWith('hsl')) {
//       normalized = color.replace(/ /g, '');
//     } else if(color.length === 4) {
//       normalized = threeDigitHexaToSixDigit(color).toUpperCase();
//     } else {
//       normalized = color.toUpperCase();
//     }

//     if(map[normalized]) {
//       map[normalized]++;
//     } else {
//       map[normalized] = 1;
//     }
//   });

//   return Object.entries(map).map(([key, value]) => ({ color: key, count: value }));
// }


// async function getColorBar(getCss, domain, width) {
//   const { css } = await getCss(domainToURL(domain), { timeout: 5000 });

//   const matches = css.match(/(#([\da-f]{3}){1,2}|(rgb|hsl)a\((\d{1,3}%?,\s?){3}(1|0?\.\d+)\)|(rgb|hsl)\(\d{1,3}%?(,\s?\d{1,3}%?){2}\))/ig);
//   // const rgbOrHSL = matches.filter(x => x.startsWith('rgb') || x.startsWith('hsl'));
//   // const hexaColors = matches.filter(x => !x.startsWith('rgb') && !x.startsWith('hsl'));
//   const result = [...countColorsFrequency(matches)];
//   // const hexaMatches = css.match(/^((0x){0,1}|#{0,1})([0-9A-F]{8}|[0-9A-F]{6})$/ig);
//   // const threeHexaMatches = css.match(/^((0x){0,1}|#{0,1})([0-9A-F]{8}|[0-9A-F]{3})$/ig);
//   // console.log(matches.length + threeHexaMatches.length + hexaMatches.length);
//   console.log(result);

//   const sorted = colorSort(result.map(x => x.color));

//   let rectWidth;
//   // let width
//   if(width) {
//     rectWidth = Number(width) / sorted.length;
//   } else {
//     // width = process.env.SVG_WIDTH;
//     rectWidth = Number(process.env.RECT_WIDTH);
//     width = rectWidth * sorted.length;
//   }

//   let svgNode = `<svg width="${width}" height="100" viewBox="0 0 ${width} 100" preserveAspectRatio="none" style="width: 100%;"><rect width="${width}" height="50" x="0" y="0" fill="#ffffff"></rect><rect width="${width}" height="50" x="0" y="50" fill="#000000"></rect>`;

//   let x = 0;
  
//   sorted.forEach((color)=> {
//     svgNode += `<rect y="0" width="2.5" x="${Math.round(x * 1000) / 1000}" height="100" fill="${color}" ></rect>`;
//     x += rectWidth;
//   });

//   return svgNode;
// }