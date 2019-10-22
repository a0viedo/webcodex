import { getDateForToday, scanDatabase2 } from '../../utils';
import { format } from 'date-fns';
exports.handler = async function handler(event, context) {
  const items = await scanDatabase2({
    date: getDateForToday(format)
  });
  console.log(`got ${items.length} results`);
  const fields = process.env.STATS_FIELDS.split(',');

  let totalFailures = 0;
  const failuresByField = {};
  fields.forEach(field => {
    failuresByField[field] = 0;
    items.forEach(item => {
      if(item[field] === '' || !item[field]) {
        failuresByField[field]++;
        totalFailures++;
      }
    });
  });
  console.log('total failures:', totalFailures);
  console.log('failures by stat:', failuresByField);

  // TODO: if totalFailures is greater than X, send a telegram message
  // TODO: if any property in failuresByField is greater than X%, send a telegram message
};