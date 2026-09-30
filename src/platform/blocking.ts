import { buildBlockRules } from './blockingRules';
import type { BlockingAdapter } from './interfaces';

export function createBlockingAdapter(extensionId: string): BlockingAdapter {
  return {
    async sync(sites: string[]): Promise<void> {
      const existing = await chrome.declarativeNetRequest.getDynamicRules();
      const removeRuleIds = existing.map((rule) => rule.id);
      const addRules = buildBlockRules(sites, extensionId).map((rule) => ({
        id: rule.id,
        priority: rule.priority,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
          redirect: {
            regexSubstitution: rule.action.redirect.regexSubstitution,
          },
        },
        condition: {
          requestDomains: rule.condition.requestDomains,
          resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
          regexFilter: rule.condition.regexFilter,
        },
      }));

      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds,
        addRules,
      });
    },
  };
}
