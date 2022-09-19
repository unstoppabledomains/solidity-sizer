import * as github from '@actions/github';
import * as core from '@actions/core';
import {GetResponseDataTypeFromEndpointMethod} from '@octokit/types';
import * as cp from 'child_process';

const MAX_CONTRACT_SIZE = 24576;
const REPORT_HEADER = `# Contracts size report
| Contract name | Size (KiB) | Delta (KiB) |
|-|-|-|
`;

const githubToken = core.getInput('GITHUB_TOKEN');
const sizeCommand = core.getInput('sizeCommand');

const context = github.context;
const octokit = github.getOctokit(githubToken);

type CommentDataType = GetResponseDataTypeFromEndpointMethod<
  typeof octokit.rest.issues.listComments
>[0];

const removeExistingComment = async (prNumber: number) => {
  let comment: CommentDataType | undefined;
  for await (const {data: comments} of octokit.paginate.iterator(
    octokit.rest.issues.listComments,
    {
      ...context.repo,
      issue_number: prNumber,
    },
  )) {
    comment = comments.find((comment) =>
      comment?.body?.includes(REPORT_HEADER),
    );
    if (comment) {
      await octokit.rest.issues.deleteComment({
        ...context.repo,
        comment_id: comment.id,
        issue_number: prNumber,
      });
      break;
    }
  }
};

const getContractsSize = (): string | undefined => {
  const contractsSize = cp.execSync(sizeCommand).toString();
  if (contractsSize.indexOf('Contract Name') === -1) {
    core.setFailed('Error while executing size-contracts: ' + contractsSize);
    return;
  }
  return contractsSize;
};

const getAlarmIcon = (contractSize: number): string => {
  if (((contractSize * 1000) / MAX_CONTRACT_SIZE) * 100 > 100) return '🚫';
  return '';
};

const buildMessage = (contractSize: string): string => {
  let message = REPORT_HEADER;

  for (const match of contractSize.matchAll(
    /\|\s+([a-zA-Z0-9\s]+)\s+·\s+(\d+?.\d+)\s+·\s+((\+|\-)\d+?.\d+)?\s+│/g,
  )) {
    const contractName = match[1].trim();
    const contractSize = Number(match[2]);
    const contractSizeDiff = match[3] ?? '0';
    message += `| ${contractName} | ${getAlarmIcon(
      contractSize,
    )} ${contractSize} | ${contractSizeDiff} |\n`;
  }

  return message;
};

const run = async () => {
  try {
    const prNumber = context.payload.pull_request?.number;

    if (!prNumber) {
      core.setFailed('No pull request in context.');
      return;
    }
    await removeExistingComment(prNumber);

    const contractsSize = getContractsSize();
    if (contractsSize) {
      const message = buildMessage(contractsSize);
      await octokit.rest.issues.createComment({
        ...context.repo,
        issue_number: prNumber,
        body: message,
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
};

run();
