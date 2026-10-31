# Builds the app's combo list from Commander Spellbook's bulk file (MIT license).
# Usage: python3 tools/build_combos.py variants.json.gz . [oracle.json]
#   (bulk file from https://json.commanderspellbook.com/variants.json.gz; oracle.json = the app's card text, used to fill Spellbook's
#    "template" pieces such as "a Persist creature" or "a haste enabler" with real cards)
import gzip,json,sys,os,re
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from states import parse
d=json.load(gzip.open(sys.argv[1]))
OO=json.load(open(sys.argv[3])) if len(sys.argv)>3 else None
if OO: from sq import matcher,Unsupported,CUSTOM
cards={}; cid={}; feats={}; out=[]; pre={}; stIdx={'':0}; st={}; vid={}; tpls={}; tplList=[]
def ci(n,i=None):
    if n not in cards: cards[n]=len(cards); cid[n]=i
    elif i and not cid[n]: cid[n]=i
    return cards[n]
def fi(n):
    if n not in feats: feats[n]=len(feats)
    return feats[n]
def front(c,name):
    if c.get('faces') and c.get('layout') in ('transform','modal_dfc','adventure','flip') and c['faces'][0].get('o') is not None:
        f=c['faces'][0]; return {**c,'o':f['o'],'t':f['t'],'p':f.get('p'),'tg':f.get('tg'),'m':f.get('m') or c.get('m')}
    return c
FR={n:front(c,n) for n,c in (OO or {}).items()}
def tpl(t):
    nm=t['name']
    if nm in tpls: return tpls[nm]
    q=t.get('scryfallQuery'); f=None
    try: f=matcher(q) if q else CUSTOM.get(nm)
    except Exception: f=None
    hits=[]
    if f:
        for n,c in FR.items():
            if 'Token' in (c.get('t') or '') or re.search(r'\b(Emblem|Card)\b$',c.get('t') or ''): continue
            try:
                if f(c,n): hits.append(n)
            except Exception: pass
    if not hits or len(hits)>2500: tpls[nm]=None; return None
    tplList.append([nm,[ci(h) for h in sorted(hits)]]); tpls[nm]=len(tplList)-1; return tpls[nm]
ZONES='BHGECL'
skipped={'tpl':0,'big':0}
for y in d['variants']:
    if not y['legalities'].get('commander'): continue
    if any(u['quantity']!=1 for u in y['uses']) or any(r['quantity']!=1 for r in y['requires']): continue
    if len(y['uses'])+len(y['requires'])>4: skipped['big']+=1; continue
    if y['requires'] and (not OO or not y['uses']): continue
    tids=[]
    if y['requires']:
        tids=[tpl(r['template']) for r in y['requires']]
        if any(t is None for t in tids): skipped['tpl']+=1; continue
    us=sorted(y['uses'],key=lambda u:u['card']['id'])
    cs=[ci(u['card']['name'],u['card']['id']) for u in us]+[-(t+1) for t in tids]
    zs=[sum(1<<ZONES.index(z) for z in u['zoneLocations'] if z in ZONES)+(64 if u['mustBeCommander'] else 0) for u in us]+[sum(1<<ZONES.index(z) for z in r['zoneLocations'] if z in ZONES)+(64 if r['mustBeCommander'] else 0) for r in y['requires']]
    pr=[p['feature'] for p in y['produces']]
    show=[f['name'] for f in pr if f['status']=='S'] or [f['name'] for f in pr if f['status']=='C'] or [f['name'] for f in pr][:1]
    if y['notablePrerequisites']: pre[len(out)]=y['notablePrerequisites'][:200]
    codes=['|'.join(f"{z}={parse(u[k],u['card']['name'])}" for z,k in (('B','battlefieldCardState'),('E','exileCardState'),('G','graveyardCardState')) if u[k]) for u in us]+['' for _ in tids]
    if any(codes): st[len(out)]=[stIdx.setdefault(c,len(stIdx)) for c in codes]
    if tids: vid[len(out)]=y['id']
    out.append(cs+zs+[fi(n) for n in show[:4]]+[len(cs)])  # [cards (template slot = -(t+1))..., zones..., feats..., nPieces]
res={'src':'Commander Spellbook (https://commanderspellbook.com), MIT license','ts':d['timestamp'],'cards':[[n,cid[n] or 0] for n in cards],'feats':list(feats),'combos':out,'states':list(stIdx),'st':st,'tpl':tplList,'vid':vid}
s=json.dumps(res,separators=(',',':'),ensure_ascii=False); open(sys.argv[2]+'/combos.json','w').write(s)
p=json.dumps({'ts':d['timestamp'],'pre':pre},separators=(',',':'),ensure_ascii=False); open(sys.argv[2]+'/combo-notes.json','w').write(p)
import gzip as gz
print(len(out),'combos',len(vid),'with templates',len(tplList),'templates',len(cards),'cards',skipped,len(s),len(gz.compress(s.encode())),'notes',len(p))
