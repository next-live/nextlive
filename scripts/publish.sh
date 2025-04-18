#!/bin/bash

# Build the library
echo "Building the library..."
npm run build:lib

# Check if the build was successful
if [ $? -ne 0 ]; then
  echo "Build failed. Aborting publish."
  exit 1
fi

# Publish to npm
echo "Publishing to npm..."
npm publish --access public

# Check if the publish was successful
if [ $? -ne 0 ]; then
  echo "Publish failed."
  exit 1
fi

echo "Successfully published @nextlive/react to npm!" 