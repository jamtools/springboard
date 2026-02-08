import springboard from 'springboard';

springboard.registerModule('Counter', {}, async (moduleAPI) => {
  let count = 0;

  const increment = () => {
    count++;
    console.log(`[Counter] Count is now: ${count}`);
    return count;
  };

  const getCount = () => count;

  return {
    increment,
    getCount,
  };
});
