const CoffeeTraceability = artifacts.require('CoffeeTraceability');
const { expect } = require('chai');

contract('CoffeeTraceability', accounts => {
  it('deploys successfully and grants DEFAULT_ADMIN_ROLE to deployer', async () => {
    const instance = await CoffeeTraceability.deployed();
    const adminRole = await instance.DEFAULT_ADMIN_ROLE();
    const isAdmin = await instance.hasRole(adminRole, accounts[0]);

    expect(instance.address).to.match(/^0x[0-9a-fA-F]{40}$/);
    expect(isAdmin).to.be.true;
  });
});
