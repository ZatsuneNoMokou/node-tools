import * as child_process from "child_process";
import path from "path";

function streamToString(stream:NodeJS.ReadableStream):Promise<string> {
	const chunks:any[] = [];
	return new Promise((resolve, reject) => {
		stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
		stream.on('error', (err) => reject(err));
		stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
	})
}

export interface DiskUsageItem {
	path: string
	size: number
}

/**
 * Parse result from linux "du" command, filtering intermediate directories
 * @param from Start point of the du command
 * @param depth Depth parameter of du command
 */
export async function diskUsage(from:string='.', depth?:number): Promise<DiskUsageItem[]> {
	from = path.resolve(process.cwd(), from);
	const args = [
		'-0'
	];
	if (depth !== undefined) {
		args.push(`-d ${depth}`);
	}
	args.push(from);

	const task = child_process.spawn('du', args, {
		shell: true
	});

	const result = streamToString(task.stdout),
		err = streamToString(task.stderr)
	;
	if (await err) {
		throw new Error(await err);
	}

	return (await result)
		.split('\0')
		.map(str => {
			const [size, item_path] = str.split(/\s/i);
			return {
				size: parseInt(size),
				path: item_path
			}
		})
		.filter((str, index, array) => {
			if (!str || !str.path) return false;

			/*
			 * Exclude intermediate dirs
			 * du list parent dirs (for exemple will display .yarn/unplugged and .yarn)
			 */
			return !array[index - 1] || !array[index - 1].path.startsWith(str.path);
		})
}
