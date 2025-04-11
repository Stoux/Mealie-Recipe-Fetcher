import { execFile } from 'node:child_process';
import { existsSync } from 'fs';

export function validateYtDlp(ytldpPath) {
    return new Promise(resolve => {
        // Make sure YT-DLP exists
        try {
            if (!existsSync(ytldpPath)) {
                console.error(`Error: yt-dlp not found at path: ${ytldpPath}`);
                console.error('Please install yt-dlp or set the YTDLP_PATH environment variable.');
                process.exit(1); // Exit if the file doesn't exist
            }
            console.log(`Using yt-dlp found at: ${ytldpPath}`);
        } catch (err) {
            console.error(`Error checking for yt-dlp at ${ytldpPath}:`, err);
            process.exit(1);
        }

        // Attempt to run Version
        execFile(ytldpPath, ['--version'], (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing '${ytldpPath} --version':`);
                console.error(error);
                if (stderr) {
                    console.error('stderr:', stderr);
                }
                process.exit(1); // Exit if --version fails
            }

            console.log(`yt-dlp version check successful: ${stdout.trim()}`);
            resolve();
        });
    })
}

export function getVideoDetails(ytldpPath, url) {
    return new Promise((resolve, reject) => {
        // Using execFile is generally safer than exec as it doesn't spawn a shell
        execFile(ytldpPath, [url, '-j'], { maxBuffer: 10 * 1024 * 1024 }, async (error, stdout, stderr) => {
            // Handle possible error output
            if (error) {
                console.error(`Error executing yt-dlp for URL: ${url}`);
                console.error(error);
                if (stderr) {
                    console.error('stderr:', stderr.trim());
                }
                reject({
                    error: 'Failed to execute yt-dlp',
                    details: stderr || error.message
                });
                return;
            }

            // Otherwise should return JSON
            try {
                const videoInfo = JSON.parse(stdout);
                const description = videoInfo.description;

                if (description === undefined || description === null) {
                    console.warn(`Warning: No 'description' field found in yt-dlp output for ${url}`);
                }

                resolve(videoInfo);
            } catch (parseError) {
                console.error('Error parsing yt-dlp JSON output:', parseError);
                console.error('yt-dlp stdout:', stdout.substring(0, 500) + '...'); // Log beginning of output
                reject({ error: 'Failed to parse yt-dlp output' });
            }
        });
    })
}
