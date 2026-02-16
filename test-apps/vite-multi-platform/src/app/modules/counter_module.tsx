import springboard from 'springboard';
import {App} from '../App';

springboard.registerModule('Counter', {}, async (moduleAPI) => {
  const states = await moduleAPI.createStates({
    count: 0,
  });

  const actions = moduleAPI.createActions({
    increment: async () => {
      states.count.setState(c => c + 1);
    },
    decrement: async () => {
      states.count.setState(c => c - 1);
    },
  })

  moduleAPI.registerRoute('/', {}, () => (
    <App
      decrement={() => actions.decrement({})}
      increment={() => actions.increment({})}
      count={states.count.useState()}
    />
  ));
});
