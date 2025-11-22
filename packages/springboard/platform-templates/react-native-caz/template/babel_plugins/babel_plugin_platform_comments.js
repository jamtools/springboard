// import {PluginObj} from '@babel/core';

// export default function babelPluginPlatformComments() { // : PluginObj {
module.exports = function () {
    return {
        visitor: {
            Program(path, state) {
                const rawSource = state.file.code;

                const platformStartRegex = /@platform "(node|browser|react-native)"/;
                const platformEndRegex = /@platform end/;

                const hasPlatformStart = platformStartRegex.test(rawSource);
                const hasPlatformEnd = platformEndRegex.test(rawSource);
                // console.log(`File: ${state.filename}, hasPlatformStart: ${hasPlatformStart}, hasPlatformEnd: ${hasPlatformEnd}`);
                if (!hasPlatformStart && !hasPlatformEnd) {
                    // console.log(`Skipping file: ${state.filename}`);
                    return;
                }
                const platform = state.opts.platform || 'react-native';
                let insideUnmatchedBlock = false;

                path.get('body').forEach(statementPath => {
                    const leadingComments = statementPath.node.leadingComments || [];

                    leadingComments.forEach(comment => {
                        const commentText = comment.value.trim();

                        // Start of a platform block
                        if (commentText.startsWith('@platform')) {
                            const [, blockPlatform] = commentText.match(/@platform "(.*?)"/) || [];

                            if (blockPlatform && blockPlatform !== platform) {
                                insideUnmatchedBlock = true;
                            } else {
                                insideUnmatchedBlock = false;
                            }
                        }

                        // End of a platform block
                        if (commentText === '@platform end') {
                            insideUnmatchedBlock = false;
                        }
                    });

                    // Notice this is outside of the loop above
                    // This removes the line that is inside of a platform block that doesn't match the current platform
                    if (insideUnmatchedBlock) {
                        statementPath.remove();
                    }
                });
            },
        },
    };
};
