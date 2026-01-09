import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export const generateReactNativeProject = async (projectName: string = 'mobile-app') => {
    console.log(`🚀 Scaffolding React Native Springboard project: ${projectName}`);
    
    // Create mobile directory if it doesn't exist
    if (!existsSync('./mobile')) {
        mkdirSync('./mobile', { recursive: true });
        console.log('✅ Created mobile directory');
    }
    
    const projectPath = join('./mobile', projectName);
    
    if (existsSync(projectPath)) {
        console.log(`⚠️ Project ${projectName} already exists in mobile directory`);
        return;
    }
    
    try {
        console.log(`🏗️ Creating React Native Springboard project using caz...`);
        
        // Use caz with the React Native Springboard template
        execSync(`npx caz @springboardjs/template-react-native ${projectName}`, { 
            cwd: './mobile',
            stdio: 'inherit' 
        });
        
        console.log('✅ React Native Springboard project created successfully!');
        console.log(`📁 Project location: ${projectPath}`);
        console.log('');
        console.log('Next steps:');
        console.log(`  cd mobile/${projectName}`);
        console.log('  npm install');
        console.log('  npm run dev');
        
    } catch (error) {
        console.error('❌ Failed to create React Native project:', error);
        console.log('');
        console.log('Make sure the React Native template is published:');
        console.log('  npm publish @springboardjs/template-react-native');
        throw error;
    }
};
