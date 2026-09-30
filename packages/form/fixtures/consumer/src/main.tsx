import {createRoot} from 'react-dom/client';

import {SignIn} from './SignIn';
import {SignUp} from './SignUp';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <>
      <SignIn signIn={async () => {}} />
      <SignUp />
    </>,
  );
}
