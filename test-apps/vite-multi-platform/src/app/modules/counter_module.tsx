import springboard from 'springboard';
import {App} from '../App';

springboard.registerModule('Counter', {}, async (moduleAPI) => {
  const states = await moduleAPI.shared.createSharedStates({
    count: 0,
  });

  const actions = moduleAPI.shared.createSharedActions({
    increment: async () => {
      states.count.setState(c => c + 1);
    },
    decrement: async () => {
      states.count.setState(c => c - 1);
    },
  })

  moduleAPI.ui.registerRoute('/', {}, () => (
    <App
      decrement={() => actions.decrement({})}
      increment={() => actions.increment({})}
      count={states.count.useState()}
    />
  ));
});
