@echo off
echo Building the library...
call npm run build:lib

if %ERRORLEVEL% neq 0 (
  echo Build failed. Aborting publish.
  exit /b 1
)

echo Publishing to npm...
call npm publish --access public

if %ERRORLEVEL% neq 0 (
  echo Publish failed.
  exit /b 1
)

echo Successfully published @nextlive/react to npm! 