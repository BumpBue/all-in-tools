import {
  runRequest,
  type RegexAnswer,
  type RegexJob,
} from '@/tools/regex-tester/logic';

// This module runs as a dedicated worker, where `self` is a
// DedicatedWorkerGlobalScope. The DOM lib types it as a Window, so the two
// calls used here are narrowed by hand rather than switching the whole project
// to the webworker lib.
const scope = self as unknown as {
  postMessage: (message: RegexAnswer) => void;
  addEventListener: (
    type: 'message',
    handler: (event: MessageEvent<RegexJob>) => void,
  ) => void;
};

scope.addEventListener('message', (event) => {
  const { id, request } = event.data;
  scope.postMessage({ id, response: runRequest(request) });
});
