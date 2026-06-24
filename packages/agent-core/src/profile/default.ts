import agentYaml from './default/agent.yaml?raw';
import coderYaml from './default/coder.yaml?raw';
import exploreYaml from './default/explore.yaml?raw';
import initMd from './default/init.md?raw';
import planYaml from './default/plan.yaml?raw';
import systemMd from './default/system.md?raw';

import auditorMd from './sdd/system/auditor.md?raw';
import developerMd from './sdd/system/developer.md?raw';
import productManagerMd from './sdd/system/product-manager.md?raw';
import techLeadMd from './sdd/system/tech-lead.md?raw';
import techSpecifierMd from './sdd/system/tech-specifier.md?raw';
import sddAuditorYaml from './sdd/sdd-auditor.yaml?raw';
import sddDeveloperYaml from './sdd/sdd-developer.yaml?raw';
import sddProductManagerYaml from './sdd/sdd-product-manager.yaml?raw';
import sddTechLeadYaml from './sdd/sdd-tech-lead.yaml?raw';
import sddTechSpecifierYaml from './sdd/sdd-tech-specifier.yaml?raw';

import { loadAgentProfilesFromSources } from './load';

// Keyed by the source path the profile loader expects: profile YAML files
// plus any file referenced through `systemPromptPath`.
const PROFILE_SOURCES: Record<string, string> = {
  'profile/default/agent.yaml': agentYaml,
  'profile/default/coder.yaml': coderYaml,
  'profile/default/explore.yaml': exploreYaml,
  'profile/default/plan.yaml': planYaml,
  'profile/default/system.md': systemMd,

  // SDD native subagent profiles
  'profile/sdd/sdd-product-manager.yaml': sddProductManagerYaml,
  'profile/sdd/sdd-tech-lead.yaml': sddTechLeadYaml,
  'profile/sdd/sdd-tech-specifier.yaml': sddTechSpecifierYaml,
  'profile/sdd/sdd-developer.yaml': sddDeveloperYaml,
  'profile/sdd/sdd-auditor.yaml': sddAuditorYaml,
  'profile/sdd/system/product-manager.md': productManagerMd,
  'profile/sdd/system/tech-lead.md': techLeadMd,
  'profile/sdd/system/tech-specifier.md': techSpecifierMd,
  'profile/sdd/system/developer.md': developerMd,
  'profile/sdd/system/auditor.md': auditorMd,
};

export const DEFAULT_INIT_PROMPT = initMd;

export const DEFAULT_AGENT_PROFILES = loadAgentProfilesFromSources(
  [
    'agent.yaml',
    'coder.yaml',
    'explore.yaml',
    'plan.yaml',
    'sdd-product-manager.yaml',
    'sdd-tech-lead.yaml',
    'sdd-tech-specifier.yaml',
    'sdd-developer.yaml',
    'sdd-auditor.yaml',
  ].map((file) => {
    if (file.startsWith('sdd-')) {
      return `profile/sdd/${file}`;
    }
    return `profile/default/${file}`;
  }),
  PROFILE_SOURCES,
);
