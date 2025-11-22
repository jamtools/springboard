const { prompt } = require('enquirer');

module.exports = {
  name: 'react-native-springboard',
  description: 'A React Native Springboard app template',
  
  prompts: [
    {
      type: 'input',
      name: 'slug',
      message: 'App slug (lowercase, no spaces):',
      default: 'my-app'
    },
    {
      type: 'input', 
      name: 'title',
      message: 'App title (display name):',
      default: 'My App'
    },
    {
      type: 'input',
      name: 'dot',
      message: 'Bundle identifier (reverse domain):',
      default: 'com.myorg.myapp'
    },
    {
      type: 'input',
      name: 'flat',
      message: 'Flat identifier (no dots):',
      default: 'myapp'
    },
    {
      type: 'input',
      name: 'siteUrl',
      message: 'Default site URL:',
      default: 'https://myapp.com'
    },
    {
      type: 'input',
      name: 'springboardVersion',
      message: 'Springboard version:',
      default: 'latest'
    },
    {
      type: 'input',
      name: 'customRnMainPackage',
      message: 'Custom RN main package (optional, e.g., @acme/rn-main):',
      default: ''
    },
    {
      type: 'input',
      name: 'customRnSharedPackage',
      message: 'Custom RN shared package (optional, e.g., @acme/rn-shared):',
      default: ''
    },
    {
      type: 'input',
      name: 'customStorePackage',
      message: 'Custom store package (optional, e.g., @acme/store):',
      default: ''
    },
    {
      type: 'input',
      name: 'customFilesPackage',
      message: 'Custom files package (optional, e.g., @acme/files):',
      default: ''
    },
    {
      type: 'confirm',
      name: 'injectCustomCode',
      message: 'Will custom code be injected after scaffolding?',
      default: true
    }
  ],

  filters: {
    'node_modules/**': false,
    '.expo/**': false,
    'dist/**': false,
    '*.log': false
  },

  complete: (data) => {
    console.log(`\n🎉 Successfully created ${data.title}!`);
    console.log('\nNext steps:');
    console.log('  cd', data.dest);
    console.log('  npm install');
    console.log('  npm run dev');
  }
};