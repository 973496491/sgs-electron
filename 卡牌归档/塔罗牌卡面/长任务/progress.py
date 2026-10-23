"""Parent-only queue synchronization after explicit single-card review."""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import hashlib
import json
import os
import subprocess
import sys

HERE=Path(__file__).resolve().parent
def read(path): return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path,value):
    temporary=path.with_name(path.name+'.next')
    temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    os.replace(temporary,path)
def controller(*args):
    result=subprocess.run([sys.executable,str(HERE/'controller.py'),*args],text=True,encoding='utf-8',capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)
    return json.loads(result.stdout)
def synchronize():
    queue=read(HERE/'tasks.json'); state=read(HERE/'runtime/state.json')
    done=state['done']; completed=[]
    for task in queue['tasks']:
        if task['id'] in done:
            record=read(HERE/'子任务'/f"{task['id']}.json")
            task['status']='done'
            task['output']=record['production']['export']['path']
            task['record']=str(HERE/'子任务'/f"{task['id']}.json")
            task['completedAt']=done[task['id']]['committedAt']
            completed.append(task)
        elif state.get('currentTask') and state['currentTask']['cardId']==task['id']:
            task['status']='generating' if state['status']=='running' else 'needs-recovery'
    generated=sum(t['operation']=='generate' for t in completed)
    reused=sum(t['operation']=='reuse' for t in completed)
    queue['progress']={'updatedAt':datetime.now(timezone.utc).isoformat(),'doneMappings':len(completed),'doneGenerations':generated,
                       'doneReuses':reused,'remainingMappings':len(queue['tasks'])-len(completed),'currentTask':state.get('currentTask')}
    write(HERE/'tasks.json',queue)
    text='# 单卡制作进度\n\n'
    text+=f"独立生成 **{generated}/{queue['summary']['uniqueGenerationTasks']}**，复用 **{reused}/{queue['summary']['reuseTasks']}**，资源花色映射 **{len(completed)}/{len(queue['tasks'])}**。\n\n"
    current=state.get('currentTask')
    text+=f"当前任务：{current['cardId'] if current else '无正在生成的卡'}。检查点状态：{state['status']}。\n\n"
    text+='已完成项均经单卡视觉检查、文件校验和主流程commit；完整信息见各卡JSON/Markdown，不能用候选文件数量替代完成数。\n\n'
    text+='默认查看[高清卡面WebP](../生产底图/压缩预览/)，每张≤200 KB；[186×260 PNG](../生产底图/186x260/)只作原图集兼容，勿放大评价清晰度。原始生成PNG独立归档，不自动制作预览页或拼图。\n\n'
    text+='| 顺序 | 卡名 | 花色 | 操作 | 单卡记录 |\n|---|---|---|---|---|\n'
    for task in completed:
        text+=f"| {task['sequence']} | {task['displayName']} | {task['suitName']} | {task['operation']} | [{task['id']}](子任务/{task['id']}.md) |\n"
    (HERE/'进度.md').write_text(text,encoding='utf-8')
    from compact_assets import synchronize as compact_synchronize
    return {**queue['progress'], 'highResolutionOutput': compact_synchronize()}
def accept(task_id):
    record_path=HERE/'子任务'/f'{task_id}.json'
    record=read(record_path)
    if record['taskId']!=task_id or record.get('status')!='reviewed' or not record.get('production') or not record.get('reviews'):
        raise ValueError('A reviewed, promoted single-card record is required')
    for item in record['production'].values():
        path=Path(item['path'])
        if hashlib.sha256(path.read_bytes()).hexdigest()!=item['sha256']:
            raise ValueError(f'Changed promoted artifact: {path}')
    export=record['production']['export']['path']
    native=record['production']['native']['path']
    controller('artifact',task_id,native,export,str(record_path))
    controller('commit',task_id,native,export,str(record_path),str(record_path.with_suffix('.md')))
    return synchronize()
def accept_next(task_id):
    result=accept(task_id)
    queue=read(HERE/'tasks.json')
    pending=sorted((t for t in queue['tasks'] if t['status']!='done'),key=lambda t:t['sequence'])
    next_task=pending[0] if pending else None
    if next_task:
        controller('begin',next_task['id'],'--artifact',str(HERE.parent/'生产底图'/'186x260'/f"{next_task['id']}.png"))
        result=synchronize()
    return {'done':result['doneMappings'],
            'next':{key:next_task.get(key) for key in ('id','sequence','displayName','suit','suitName','operation','badge','reuseOfTaskId')} if next_task else None,
            'maxWebpBytes':result['highResolutionOutput']['maxPreviewBytes']}
if __name__=='__main__':
    if hasattr(sys.stdout,'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
    parser=argparse.ArgumentParser()
    parser.add_argument('command',choices=['sync','accept','accept-next'])
    parser.add_argument('task_id',nargs='?')
    args=parser.parse_args()
    if args.command!='sync' and not args.task_id:parser.error('task_id is required')
    result=accept_next(args.task_id) if args.command=='accept-next' else accept(args.task_id) if args.command=='accept' else synchronize()
    print(json.dumps(result,ensure_ascii=False,indent=2))
