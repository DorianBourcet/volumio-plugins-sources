function Foo() {
  this.myVariable = 'foo';

  this.getMyVariable = function() {
    console.log('IN_FOO');
    return this.myVariable;
  }
}

module.exports = Foo;