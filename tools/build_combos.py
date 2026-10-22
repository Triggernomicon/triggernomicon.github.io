# Builds the app's combo list from Commander Spellbook's bulk file (MIT license).
# Usage: python3 tools/build_combos.py variants.json.gz .   (bulk file from https://json.commanderspellbook.com/variants.json.gz)
import gzip,json,sys
d=json.load(gzip.open(sys.argv[1]))
cards={}; cid={}; feats={}; out=[]; pre={}
def ci(c):
    n=c['name']
    if n not in cards: cards[n]=len(cards); cid[n]=c['id']
    return cards[n]
def fi(n):
    if n not in feats: feats[n]=len(feats)
    return feats[n]
ZONES='BHGECL'
for y in d['variants']:
    if not y['legalities'].get('commander') or y['requires'] or len(y['uses'])>4: continue
    if any(u['quantity']!=1 for u in y['uses']): continue
    us=sorted(y['uses'],key=lambda u:u['card']['id'])
    cs=[ci(u['card']) for u in us]
    zs=[sum(1<<ZONES.index(z) for z in u['zoneLocations'] if z in ZONES)+(64 if u['mustBeCommander'] else 0) for u in us]
    pr=[p['feature'] for p in y['produces']]
    show=[f['name'] for f in pr if f['status']=='S'] or [f['name'] for f in pr if f['status']=='C'] or [f['name'] for f in pr][:1]
    if y['notablePrerequisites']: pre[len(out)]=y['notablePrerequisites'][:200]
    out.append(cs+zs+[fi(n) for n in show[:4]]+[len(cs)])  # [cards..., zones..., feats..., nCards]
res={'src':'Commander Spellbook (https://commanderspellbook.com), MIT license','ts':d['timestamp'],'cards':[[n,cid[n]] for n in cards],'feats':list(feats),'combos':out}
s=json.dumps(res,separators=(',',':'),ensure_ascii=False); open(sys.argv[2]+'/combos.json','w').write(s)
p=json.dumps({'ts':d['timestamp'],'pre':pre},separators=(',',':'),ensure_ascii=False); open(sys.argv[2]+'/combo-notes.json','w').write(p)
print(len(out),len(cards),len(feats),len(s),len(gzip.compress(s.encode())),'notes',len(p),len(gzip.compress(p.encode())))
