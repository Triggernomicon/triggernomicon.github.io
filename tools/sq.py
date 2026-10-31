# A small Scryfall-query evaluator over oracle text, for Commander Spellbook's template cards
import re
KW_EXTRA = {}
class Unsupported(Exception): pass
def tokenize(q):
    toks=[]; i=0
    while i<len(q):
        c=q[i]
        if c.isspace(): i+=1; continue
        if c in '()': toks.append(c); i+=1; continue
        if c=='-' and i+1<len(q) and q[i+1]=='(': toks.append('NEG'); i+=1; continue
        j=i; neg=False
        if c=='-' : neg=True; j+=1
        # !"exact name"
        if q[j:j+2]=='!"':
            k=q.index('"',j+2); toks.append(('name',neg,q[j+2:k])); i=k+1; continue
        m=re.match(r'([a-zA-Z]+)(:|=|!=|<=|>=|<|>)',q[j:])
        if m:
            key,op=m.group(1).lower(),m.group(2); k=j+len(m.group(0))
            if k<len(q) and q[k]=='"':
                e=q.index('"',k+1); val=q[k+1:e]; i=e+1
            elif k<len(q) and q[k]=='/':
                e=k+1
                while q[e]!='/' or q[e-1]=='\\': e+=1
                val=('re',q[k+1:e]); i=e+1
            else:
                e=k
                while e<len(q) and not q[e].isspace() and q[e] not in '()': e+=1
                val=q[k:e]; i=e
            toks.append(('kv',neg,key,op,val)); continue
        e=j
        while e<len(q) and not q[e].isspace() and q[e] not in '()': e+=1
        w=q[j:e]; i=e
        if w.lower()=='or' and not neg: toks.append('or')
        elif w.lower()=='and' and not neg: pass
        else: toks.append(('word',neg,w))
    return toks
def parse(toks):
    pos=[0]
    def expr():
        terms=[seq()]
        while pos[0]<len(toks) and toks[pos[0]]=='or': pos[0]+=1; terms.append(seq())
        return ('or',terms)
    def seq():
        items=[]
        while pos[0]<len(toks) and toks[pos[0]] not in ('or',')'):
            t=toks[pos[0]]
            if t=='NEG':
                pos[0]+=1
                if pos[0]<len(toks) and toks[pos[0]]=='(':
                    pos[0]+=1; e=expr()
                    if pos[0]<len(toks) and toks[pos[0]]==')': pos[0]+=1
                    items.append(('not',e))
                continue
            if t=='(':
                pos[0]+=1; e=expr()
                if pos[0]<len(toks) and toks[pos[0]]==')': pos[0]+=1
                items.append(e)
            elif isinstance(t,tuple) and t[0]=='word' and t[2]=='-(' : pos[0]+=1
            else: items.append(t); pos[0]+=1
        return ('and',items)
    e=expr()
    return e
COL={'w':'W','u':'U','b':'B','r':'R','g':'G','white':'W','blue':'U','black':'B','red':'R','green':'G'}
def mv(c):
    m=c.get('m') or ''
    n=0
    for s in re.findall(r'\{([^}]+)\}',m):
        if s.isdigit(): n+=int(s)
        elif s in ('X','Y','Z'): pass
        else: n+=1
    return n
def colors(c): return set(re.findall(r'[WUBRG]', ''.join(re.findall(r'\{[^}]+\}',c.get('m') or ''))))
def num(v):
    try: return float(v)
    except: raise Unsupported(v)
def cmp(a,op,b):
    return {'=':a==b,':':a==b,'!=':a!=b,'<':a<b,'>':a>b,'<=':a<=b,'>=':a>=b}[op]
def oracle(c,name):
    o=re.sub(r'\s*\([^)]*\)','',c.get('o') or '')
    short=name.split(' // ')[0]
    return o.replace(short,'~').replace(short.split(',')[0],'~').replace('this creature','~').replace('This creature','~')
def kws(c):
    o=re.sub(r'\([^)]*\)','',c.get('o') or '')
    out=set()
    for l in o.split('\n'):
        l=l.strip()
        first=re.split(r'[—:]',l)[0]
        for p in re.split(r',\s*|;\s*',first):
            w=re.sub(r'\s*(\{[^}]*\}|\d+|X)\s*$','',p.strip()).strip().lower()
            if w and len(w.split())<=3 and re.match(r'^[a-z\' -]+$',w): out.add(w)
    return out
def ev(node,c,name):
    k=node[0]
    if k=='or': return any(ev(x,c,name) for x in node[1])
    if k=='not': return not ev(node[1],c,name)
    if k=='and':
        return all(ev(x,c,name) for x in node[1])
    if k=='name':
        v=(name==node[2] or name.split(' // ')[0]==node[2]); return (not v) if node[1] else v
    if k=='word':
        raise Unsupported(node[2])
    _,neg,key,op,val=node
    t=c.get('t') or ''
    if key in ('t','type'):
        v=re.search(r'\b'+re.escape(val)+r'\b',t,re.I) is not None or (val.lower()=='inst' and 'Instant' in t) or (val.lower()=='sorc' and 'Sorcery' in t)
    elif key in ('kw','keyword'):
        kk=kws(c); v=any(k==val.lower() or k.startswith(val.lower()+' ') for k in kk)
    elif key in ('o','oracle'):
        txt=oracle(c,name)
        if isinstance(val,tuple):
            pat=val[1].replace('\\sc','\\{[WUBRG]\\}').replace('~','~')
            v=re.search(pat,txt,re.I|re.M) is not None
        else: v=val.lower().replace('this creature','~') in txt.lower()
    elif key in ('mv','cmc','manavalue'):
        v=cmp(mv(c),op,num(val))
    elif key in ('pow','power'):
        p=c.get('p'); 
        if p is None or not re.match(r'^-?\d+$',str(p)): v=False
        else: v=cmp(int(p),op,num(val))
    elif key in ('tou','toughness'):
        p=c.get('tg')
        if p is None or not re.match(r'^-?\d+$',str(p)): v=False
        else: v=cmp(int(p),op,num(val))
    elif key in ('mana','m'):
        m=c.get('m') or ''
        if isinstance(val,str) and val and '{' not in val: val=''.join('{%s}'%x for x in (re.findall(r'\d+|[A-Z]',val.upper())))
        if op in ('>=','>'): return (not True) if neg else True
        if op in ('=',): v=m==val
        elif op==':': v=val in m
        elif op=='<': v=(m!=val) and all(x in val for x in re.findall(r'\{[^}]+\}',m)) and m!=''  # rough: "-m<{0}" means mana cost strictly less than {0}: i.e. no mana cost
        else: raise Unsupported('mana'+op)
        if op=='<' and val=='{0}': v = (m=='')
    elif key in ('c','color','ci','id','identity'):
        cs=colors(c)
        if val.lower() in ('c','colorless','0'): v = (len(cs)==0) if op in (':','=') else False
        else:
            want=set(COL.get(ch,ch.upper()) for ch in ([val.lower()] if val.lower() in COL else list(val.lower())))
            v = (cs==want) if op=='=' else want<=cs if op in (':','>=') else cs<=want if op=='<=' else False
    elif key=='is':
        lay=c.get('layout') or ''
        if val=='dfc': v=lay in ('transform','modal_dfc','reversible_card')
        elif val=='tdfc': v=lay=='transform'
        elif val=='spell': v=not re.search(r'\bLand\b',t)
        elif val=='permanent': v=not re.search(r'\b(Instant|Sorcery)\b',t)
        elif val in ('commander',): v=('Legendary' in t and 'Creature' in t)
        elif val=='flip': v=(c.get('layout')=='flip')
        elif val=='hybrid': v=bool(re.search(r'\{[WUBRG2]/[WUBRG]\}',c.get('m') or ''))
        else: raise Unsupported('is:'+val)
    elif key=='otag': v=OTAG[val](c,name) if val in OTAG else False  # Scryfall's tags aren't in our data: a few are rebuilt from the text, the rest count as no
    elif key=='legal': v=True
    else: raise Unsupported(key)
    return (not v) if neg else v
def compile_q(q):
    return parse(tokenize(q))
def matcher(q):
    tree=compile_q(q)
    def f(c,name):
        return ev(tree,c,name)
    return f

def _o(c): return re.sub(r'\s*\([^)]*\)','',c.get('o') or '')
def _t(c): return c.get('t') or ''
R=lambda p: (lambda c,n: re.search(p,_o(c),re.I|re.M) is not None)
OTAG={
 'mana-dork': lambda c,n: 'Creature' in _t(c) and re.search(r'^\{T\}(?:, [^:]*)?: Add ',_o(c),re.M) is not None,
 'gives-lifelink': R(r'\b(?:have|has|gains?|gain) [^.]*\blifelink\b'),
 'gives-indestructible': R(r'\b(?:have|has|gains?|gain) [^.]*\bindestructible\b'),
 'gives-haste': R(r'\b(?:have|has|gains?|gain) [^.]*\bhaste\b'),
 'copy-creature': R(r'\bcopy of (?:target|another|a|any|enchanted|that) [^.]*creature|becomes? a copy of'),
 'animate-artifact': R(r'target (?:noncreature )?artifact[^.]* becomes an? (?:\d+/\d+ )?artifact creature|artifacts? you control (?:are|become) [^.]*artifact creatures'),
 'animate-land': R(r'\bland[^.]* becomes? an? (?:\d+/\d+ )?[^.]*creature'),
 'manland': lambda c,n: 'Land' in _t(c) and re.search(r'^[^\n]*: (?:Until end of turn, )?(?:this land|~|it|'+re.escape(n.split(' // ')[0])+r') becomes an? \d+/\d+',_o(c),re.M|re.I) is not None,
 'man-land': lambda c,n: OTAG['manland'](c,n),
 'adds-multiple-mana': R(r'^\{T\}(?:, [^:]*)?: Add (?:\{[^}]+\}){2,}|^\{T\}(?:, [^:]*)?: Add (?:two|three) mana'),
 'untapper-creature': R(r'\buntap (?:target|another target|up to \w+ target) creature'),
 'regrowth-instant': R(r'return (?:up to one )?target instant[^.]* card from your graveyard to your hand'),
 'regrowth-sorcery': R(r'return (?:up to one )?target [^.]*sorcery card from your graveyard to your hand'),
 'gives-pp-counters': R(r'\+1/\+1 counter'),
}
CUSTOM={
 'Haste Enabler': R(r'\b(?:equipped|enchanted|target|another target|up to one target) creature (?:has|gains?|have) [^.]*\bhaste\b|\ball creatures have haste|\b(?:creatures you control|other creatures you control|each creature you control|creatures you control with [^.]*) (?:have|gain) [^.]*\bhaste\b|\b(?:has|have) haste as long as|\bcreature spells you cast have haste|\bcreatures you control have haste\b'),
 "Effects that Alter a Creature's Power/Toughness (Anthem Effects)": R(r'^(?:other )?(?:[A-Z][a-z]+ )*creatures you control get \+\d+/\+\d+'),
 'Gives +1/+1 counter to creatures that enter': R(r'each (?:other )?(?:non-?token )?creature you control enters with (?:an )?additional \+1/\+1 counter|^(?:whenever )?(?:another )?creature you control enters, put a \+1/\+1 counter on (?:it|that creature)'),
 'Increases +1/+1 Counter Placement but not -1/-1': R(r'if one or more \+1/\+1 counters would be put on [^.]*?, (?:that many plus one|twice that many) \+1/\+1 counters'),
 'Permanent with Landfall Ability: Create Creature Token(s)': R(r'^(?:landfall — )?whenever a land (?:you control )?enters(?: the battlefield)?(?: under your control)?, [^.]*create [^.]*creature token'),
 'Creature that earthbends on entering': lambda c,n: 'Creature' in _t(c) and re.search(r'^when (?:~|this creature|'+re.escape(n.split(',')[0])+r') enters[^.]*earthbend',_o(c),re.I|re.M) is not None,
 'Haste Enabler ': None,
 'Card That Animates a Land': R(r'\btarget land[^.]* becomes? an? (?:\d+/\d+ )?[^.]*creature|lands you control (?:are|become) [^.]*creatures'),
 'Card Giving Creatures -1/-1': R(r'\b(?:all |other )?creatures(?: your opponents control| you don\'t control)? get -1/-1\b'),
 'Extra Turn Spell - GY on Resolution': lambda c,n: re.search(r'\b(Instant|Sorcery)\b',_t(c)) is not None and re.search(r'^take an extra turn after this one\.?$',_o(c),re.I|re.M) is not None,
 'Creature with "When this creature ETBs, create 1+ creature token(s)"': lambda c,n: 'Creature' in _t(c) and re.search(r'^when (?:~|this creature|'+re.escape(n.split(',')[0])+r') enters[^.]*create [^.]*creature tokens?',_o(c),re.I|re.M) is not None,
 'Creature with "When this creature ETBs, create 2+ creature tokens"': lambda c,n: 'Creature' in _t(c) and re.search(r'^when (?:~|this creature|'+re.escape(n.split(',')[0])+r') enters[^.]*create (?:two|three|four|five|x) [^.]*creature tokens',_o(c),re.I|re.M) is not None,
 'Creature that taps for 2+ mana': lambda c,n: 'Creature' in _t(c) and re.search(r'^\{T\}: Add (?:\{[^}]+\}){2,}',_o(c),re.M) is not None,
 'Permanent with "You don\'t lose the game due to having 0 or less life"': R(r"you don't lose the game for having 0 or less life"),
 'Cards Allowing a Creature to Tap for Free': None,
 'Card that Gives a Creature Deathtouch': R(r'\b(?:have|has|gains?|gain) [^.]*\bdeathtouch\b'),
 'Creature with MV=1 and Creates Creature Token(s) on Death': lambda c,n: 'Creature' in _t(c) and mv(c)==1 and re.search(r'^when (?:~|this creature|'+re.escape(n.split(',')[0])+r') dies, create [^.]*creature token',_o(c),re.I|re.M) is not None,
 'One-drop creature with a second body': None,
 'Creature that gains at least 4 life': None,
 'Card that Creates One or More Creature Tokens Per Turn': None,
}
