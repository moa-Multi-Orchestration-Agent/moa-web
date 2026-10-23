import type { RequestHandler } from 'msw';
import { agentHandlers } from './agents';
import { authHandlers } from './auth';
import { billingHandlers } from './billing';
import { contextHandlers } from './context';
import { deployHandlers } from './deploy';
import { integrationHandlers } from './integrations';
import { marketHandlers } from './market';
import { middleware } from './middleware';
import { runHandlers } from './runs';
import { templateHandlers } from './templates';
import { workflowHandlers } from './workflows';
import { workspaceHandlers } from './workspaces';

/** design.md 2.6.2 엔드포인트 전부 + 화면에 필요한 조회 API(frontend-plan 5절) */
export const handlers: RequestHandler[] = [
  ...middleware,
  ...authHandlers,
  ...workspaceHandlers,
  ...agentHandlers,
  ...workflowHandlers,
  ...runHandlers,
  ...contextHandlers,
  ...integrationHandlers,
  ...deployHandlers,
  ...templateHandlers,
  ...marketHandlers,
  ...billingHandlers,
];
