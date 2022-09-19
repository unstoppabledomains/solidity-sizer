# solidity-sizer

A GitHub action that comments the pull request with the size of the Solidity
contracts.

## Usage

### Contracts size and delta

hardhat size-contracts doesn't support git based delta calculation, it uses
cache/.hardhat_contract_sizer_output.json to store contracts size data and then
just compare new results against this file to get delta.

So, we need two jobs to get the delta between the source and target branches:

- `target-contracts-size` will checkout the target branch, run hardhat
  size-contracts and put `cache/.hardhat_contract_sizer_output.json` into the
  artifacts.
- `pr-contracts-size` will checkout the source branch, download artifacts and
  run solidity-sizer which will calculate the delta using
  `hardhat_contract_sizer_output.json` from `target-contracts-size`

```yml
on: pull_request

jobs:
  target-contracts-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
        with:
          ref: ${{ github.event.pull_request.base.ref }}
      - uses: actions/setup-node@v2
        with:
          node-version: 16.x
      - run: yarn install
      - run: yarn compile:size
      - uses: actions/upload-artifact@v3
        with:
          name: hardhat-contract-sizer-output
          path: cache/.hardhat_contract_sizer_output.json

  pr-contracts-size:
    runs-on: ubuntu-latest
    needs: target-contracts-size
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: 16.x
      - run: yarn install
      - uses: actions/download-artifact@v3
        with:
          name: hardhat-contract-sizer-output
          path: cache/
      - uses: unstoppabledomains/solidity-sizer@aslobodian/REG-641
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Only contracts size

```yml
on: pull_request
  contracts-size:
    runs-on: ubuntu-latest
    needs: target-contracts-size
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: 16.x
      - run: yarn install
      - uses: actions/download-artifact@v3
        with:
          name: hardhat-contract-sizer-output
          path: cache/
      - uses: unstoppabledomains/solidity-sizer@aslobodian/REG-641
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

### Action inputs

| Name           | Description                                  | Required | Default                         |
| -------------- | -------------------------------------------- | -------- | ------------------------------- |
| `GITHUB_TOKEN` | Token that is used to create comment         | ✅       |                                 |
| `sizeCommand`  | Command that will run hardhat size-contracts |          | yarn run hardhat size-contracts |
