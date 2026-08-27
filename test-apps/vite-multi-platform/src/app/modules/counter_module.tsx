import springboard from 'springboard';
import {defineRoute, defineRoutes} from 'springboard/router';
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

  const CounterRoute = () => (
      <App
        decrement={() => actions.decrement({})}
        increment={() => actions.increment({})}
        count={states.count.useState()}
      />
  );

  return {
    routes: defineRoutes([
      defineRoute({path: '/', component: CounterRoute}),
    ]),
  };
});
