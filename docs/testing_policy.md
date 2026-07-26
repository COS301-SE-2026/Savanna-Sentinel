# SIGILL Testing Policy Document

---

## Table of Contents

---

## Introduction

This document will detail the process and ideology that is enforced when writing test cases for Savanna Sentinel. Testing ensures that all features, especially old features, retain all intended functionality when changes are made.

## Testing tools used

### Vitest

Vitest is our testing framework for unit tests involving the frontend. Vitest was chosen as it comes bundled with our frontend runner of vite, ensuring that configuration files do not need to be duplicated, and uses syntax that matches the Jest framework, meaning tests are easy to write.

### Playwright

Playwright is the testing framework used for our e2e tests. Playwright was chosen for its automated support in testing various browser agents/clients from a single configuration file, without needing to rewrite every test case, as well as its report generation functionality allowing it to work within our CI. Playwright will also be used to test offline functionality within the PWA, due to starting headless browser instances.

### Pytest

Pytest is the testing framework for the backend code, used to perform unit and integration tests.

### CodeCov

CodeCov is a suite used on our CI pipeline to ensure that at least 75% of new code being introduced into a PR is run by our test suite. This partially ensures that a majority of the new code remains tested and functional according to requirements.

### SonarQube

SonarQube was chosen so it flags various issues that a traditional linter would not pick up, such as maintainability and security issues, improving the quality of code that is submitted.

### K6

K6 is used to run performance tests for the application, to ensure that various features of the application run under expected loads, and fails CI if performance is not met. K6 was chosen due to its easy integration with Github Actions

## Test Suite Process

### Github Actions

Github Actions is our choice of CI.

Whenever a pull request or push to dev/main is made, actions will run our frontend, backend, e2e, and performance suite, to ensure that code meets functional and non-functional requirements.

## Testing Types & Objectives

### Unit

Unit tests must be performed for every individual frontend and backend file. Unit tests are allowed to mock any dependencies of modules that are not currently being tested.
Unit tests must test at least the following

- A failure condition
- A success condition
- Error conditions

These tests must reach at least 75% coverage of the component they are testing, but ideally must reach 100%.

### Integration

integration tests must be performed for every endpoint that is available on the FastAPI backend. integration tests must test for every response code that the endpoint can return, as well as test how the endpoint responds to incorrect user data, or malformed or corrupted data. It must also test the same conditions as a unit test, but must only be performed on the backend

### E2E (End to End) Tests

E2E tests must be performed for every page and route that is on the frontend. E2E tests must test a normal user flow, as well as an abnormal user flow, and ensure that all errors or response messages show up successfully on the 3 major browser engines (Chromium, Webkit, FIrefox ), as well as testing the application renders correctly on mobile devices. It must additionally test that all offline application functionality works on all mobile devices.

### Performance Tests

Performance tests are run to ensure that the non-functional requirements of the application are satisfied, such as simulating various endpoints being hit with concurrent requests under normal and stress loads.

## Acceptance Criteria

The following conditions must be met for a pull request to be merged based on CI results

* CodeCov coverage is at least 75%
* Sonarqube passes

  * This can be vetoed by the leader in the case of superficial errors on a case by case basis, if a comment explaining why it is being ignored is left on the PR
* Frontend CI, Backend CI, E2E test suite passes.
* All functionality of the new components is tested.
* Integration tests are included for backend tests.
* E2E tests are included for new frontend pages

If acceptance criteria are not met, especially if CI is failing, the PR will not be reviewed until the errors are fixed, please reach out to the team if you are having issues with CI passing so that they can assist.

If performance tests are failing, a request can be made to still merge the PR if everything else remains functional, given that an investigation into why performance is underperforming is launched and an effort is made to improve performance in the future.

## Stakeholders

### Usability Testing

Currently Usability Testing is not being performed as the interface for application is still being developed, but the possibility of integrating stakeholders into the test lifecycle will be considered in the next demo, and this document will be updated accordingly.
