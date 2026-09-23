#!/usr/bin/env node
/**
 * 对主流程数据集-2026-09-22运行完整的15问题推理，并快照所有LLM输入输出
 * 
 * 功能：
 * 1. 在 主流程数据集-2026-09-22 目录下运行完整推理流程
 * 2. 拦截所有 LLM 调用，快照每次的 prompt + response
 * 3. 保留所有中间数据文件
 * 4. 生成汇总报告
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET_DIR = path.join(__dirname, '主流程数据集-2026-09-22');
const SNAPSHOT_DIR = path.join(TARGET_DIR, 'llm-snapshots');
const BASE_DIR = __dirname;

console.log('='.repeat(80));
console.log('主流程数据集-2026-09-22 完整推理 + LLM 快照');
console.log('='.repeat(80));
console.log(`目标目录: ${TARGET_DIR}`);
console.log(`快照目录: ${SNAPSHOT_DIR}`);
console.log('='.repeat(80));

// 检查目标目录和前置文件
if (!fs.existsSync(TARGET_DIR)) {
  console.error(`❌ 目标目录不存在: ${TARGET_DIR}`);
  process.exit(1);
}

const FINAL_NOUN_INDEX = path.join(TARGET_DIR, 'final-noun-index.json');
if (!fs.existsSync(FINAL_NOUN_INDEX)) {
  console.error(`❌ 缺少 final-noun-index.json: ${FINAL_NOUN_INDEX}`);
  process.exit(1);
}

// 创建快照目录
if (!fs.existsSync(SNAPSHOT_DIR)) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
}

// 复制必需的依赖文件到目标目录
console.log('\n步骤0: 准备依赖文件...');
const FILES_TO_COPY = [
  'test-questions.json',
  'noun-blacklist.json',
  'src/core/llmClient.js',
  'src/core/pureTextTable.js'
];

console.log(`  BASE_DIR: ${BASE_DIR}`);
for (const file of FILES_TO_COPY) {
  const srcPath = path.join(BASE_DIR, file);
  const destPath = path.join(TARGET_DIR, file);
  console.log(`  检查: ${srcPath} 存在=${fs.existsSync(srcPath)}`);
  if (fs.existsSync(srcPath)) {
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    // 对 llmClient.js 特殊处理：修改快照目录路径
    if (file === 'src/core/llmClient.js') {
      let content = fs.readFileSync(srcPath, 'utf-8');
      // 将快照目录从相对路径改为绝对路径（指向 TARGET_DIR/llm-snapshots）
      const snapshotDirEscaped = SNAPSHOT_DIR.replace(/\\/g, '\\\\');
      const oldPattern = "const SNAPSHOT_DIR = path.join(__dirname, 'llm-snapshots');";
      const newValue = `const SNAPSHOT_DIR = '${snapshotDirEscaped}';`;
      
      if (!content.includes(oldPattern)) {
        console.warn(`    ⚠️  警告: 未找到预期的 SNAPSHOT_DIR 定义`);
        console.warn(`    查找: ${oldPattern}`);
        const snapshotLines = content.split('\n').filter(l => l.includes('SNAPSHOT_DIR'));
        console.warn(`    实际: ${snapshotLines[0] || '(未找到)'}`);
      }
      
      content = content.replace(oldPattern, newValue);
      fs.writeFileSync(destPath, content, 'utf-8');
      const verify = fs.readFileSync(destPath, 'utf-8');
      const verifyLine = verify.split('\n').find(l => l.includes('SNAPSHOT_DIR ='));
      console.log(`    → 写入后校验 destPath=${destPath}`);
      console.log(`    → 写入后实际内容: ${verifyLine}`);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
    
    console.log(`  ✓ 复制 ${file}`);
  } else {
    console.warn(`  ⚠️  跳过不存在的文件: ${file}`);
  }
}

// 复制主流程脚本到目标目录
console.log('\n步骤1: 确保快照目录已创建...');
if (!fs.existsSync(SNAPSHOT_DIR)) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  console.log(`  ✓ 创建快照目录: ${SNAPSHOT_DIR}`);
}

console.log('\n步骤2: 复制主流程脚本...');
const SCRIPTS_TO_COPY = [
  'recall-nouns-llm.js',
  'build-prompt-with-traceback.js',
  'generate-multipath-prompt.js',
  'run-reasoning.js'
];

for (const script of SCRIPTS_TO_COPY) {
  const srcPath = path.join(BASE_DIR, script);
  const destPath = path.join(TARGET_DIR, script);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`  ✓ 复制 ${script}`);
  } else {
    console.error(`  ❌ 缺少脚本: ${script}`);
    process.exit(1);
  }
}

// 执行完整推理流程
console.log('\n' + '='.repeat(80));
console.log('步骤3: 执行完整推理流程（15个问题）');
console.log('='.repeat(80));

const startTime = Date.now();
const NODE_EXE = process.execPath; // 使用当前 Node.js 可执行文件路径

// 加载 .env 文件
const envPath = path.join(BASE_DIR, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
  console.log('✓ 已加载 .env 配置');
} else {
  console.warn('⚠️  未找到 .env 文件');
}

if (!process.env.LLM_API_KEY && !process.env.DEEPSEEK_API_KEY) {
  console.error('❌ 缺少 LLM_API_KEY 或 DEEPSEEK_API_KEY，请在 .env 文件中配置');
  process.exit(1);
}

try {
  // 切换到目标目录执行
  const env = {
    ...process.env,
    DOCUVERSE_PATH: process.env.DOCUVERSE_PATH || 'C:\\Users\\Administrator\\Desktop\\docuverse_cartographies_squizoanalythiques_Fe_lix_Guattari_1789114122714.docuverse.json'
  };
  
  console.log('\n阶段1: 名词召回（粗筛+精打分）...');
  execSync(`"${NODE_EXE}" recall-nouns-llm.js`, {
    cwd: TARGET_DIR,
    stdio: 'inherit',
    env
  });
  
  console.log('\n阶段2: 构建推理输入（拓扑链+溯源映射）...');
  execSync(`"${NODE_EXE}" build-prompt-with-traceback.js`, {
    cwd: TARGET_DIR,
    stdio: 'inherit',
    env
  });
  
  // 读取问题列表
  const questions = JSON.parse(fs.readFileSync(path.join(TARGET_DIR, 'test-questions.json'), 'utf-8'));
  
  console.log('\n阶段3-4: 生成Prompt并执行推理...');
  for (const q of questions) {
    console.log(`\n处理问题 [${q.id}]: ${q.question}`);
    
    execSync(`"${NODE_EXE}" generate-multipath-prompt.js ${q.id}`, {
      cwd: TARGET_DIR,
      stdio: 'inherit',
      env
    });
    
    execSync(`"${NODE_EXE}" run-reasoning.js ${q.id}`, {
      cwd: TARGET_DIR,
      stdio: 'inherit',
      env
    });
  }
  
} catch (err) {
  console.error('\n❌ 流程执行失败');
  console.error(err.message);
  process.exit(1);
}

const totalElapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

console.log('\n' + '='.repeat(80));
console.log('✅ 完整推理流程执行完毕');
console.log('='.repeat(80));
console.log(`总耗时: ${totalElapsed} 分钟`);
console.log(`\n所有文件已保存到: ${TARGET_DIR}`);
console.log(`\nLLM 调用快照: ${SNAPSHOT_DIR}`);
console.log(`  - call-NNNN-request.json  (请求元数据)`);
console.log(`  - call-NNNN-prompt.txt    (完整输入)`);
console.log(`  - call-NNNN-response.json (响应元数据)`);
console.log(`  - call-NNNN-output.txt    (完整输出)`);
console.log(`\n中间数据文件:`);
console.log(`  - noun-recall-results.json`);
console.log(`  - candidate-texts-for-llm.json`);
console.log(`  - material-traceback-map.json`);
console.log(`  - multipath-prompt-<id>.txt (15个)`);
console.log(`  - reasoning-output-<id>.json (15个)`);

// 生成汇总报告
const snapshotFiles = fs.readdirSync(SNAPSHOT_DIR).filter(f => f.endsWith('-response.json'));
console.log(`\n生成汇总报告...`);
const summary = {
  executionTime: totalElapsed + ' minutes',
  totalLLMCalls: snapshotFiles.length,
  calls: []
};

for (const file of snapshotFiles.sort()) {
  const data = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, file), 'utf-8'));
  summary.calls.push({
    callId: data.callId,
    success: data.success,
    elapsed: (data.elapsed / 1000).toFixed(1) + 's',
    promptTokens: data.response?.usage?.prompt_tokens,
    completionTokens: data.response?.usage?.completion_tokens,
    totalTokens: data.response?.usage?.total_tokens,
    truncated: data.response?.truncated
  });
}

fs.writeFileSync(
  path.join(TARGET_DIR, 'execution-summary.json'),
  JSON.stringify(summary, null, 2),
  'utf-8'
);
console.log(`✓ 汇总报告已保存: execution-summary.json`);
