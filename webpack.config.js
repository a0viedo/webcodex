const webpack = require('webpack');
const slsw = require('serverless-webpack');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  mode: 'production',
  // mode: 'development',
  entry: slsw.lib.entries,
  target: 'node',
  externals: [nodeExternals()],
  plugins: [
    // new webpack.IgnorePlugin(/chrome-aws-lambda/),
    // new webpack.IgnorePlugin(/utils/)
  ],
  // devtool: '#inline-source-map',
  // compress: {
  //   drop_debugger: false
  // }
};