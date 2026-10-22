import re
NUM={'a':1,'an':1,'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9,'ten':10}
def num(w): return NUM.get(w.lower(), int(w) if w.isdigit() else None)
def part(s, name):
    s=s.strip().rstrip('.').strip()
    s=s.replace(name,'~')
    if not s: return None
    if s in('without summoning sickness','doesn\'t have summoning sickness'): return 'ns'
    if s in('untapped','is untapped'): return 'untap'
    if s in('tapped','is tapped'): return 'tap'
    m=re.fullmatch(r"(with|without) (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)(?: (or more|or fewer))? ([\w+/\-−]+(?: [\w]+)?) counters? on it",s)
    if m:
        w,n,mod,lab=m.groups(); n=num(n)
        if w=='without': return f'c:{lab}:<:{n}' if n>1 else f'c:{lab}:=:0'
        return f'c:{lab}:<=:{n}' if mod=='or fewer' else f'c:{lab}:>=:{n}'
    m=re.fullmatch(r"with at least (one|two|three|four|five|\d+) ([\w+/\-−]+(?: [\w]+)?) counters? on it",s)
    if m: return f'c:{m.group(2)}:>=:{num(m.group(1))}'
    m=re.fullmatch(r"(?:exiled )?by (.+)",s)
    if m and m.group(1)!='its paradigm ability': return f'exby:{m.group(1)}'
    m=re.fullmatch(r"is (?:at least )?level (\d+)(?: or (?:higher|greater))?",s)
    if m: return f'lvl:{m.group(1)}'
    m=re.fullmatch(r'with "([^"]+)" chosen',s)
    if m: return f'ch:{m.group(1)}'
    if re.fullmatch(r"(?:is )?attached to (?:another|any other|any|a) creature(?: you control)?",s): return 'att'
    m=re.fullmatch(r"(?:is )?attached to (.+)",s)
    if m and m.group(1) not in('you','an opponent','a player'): return f'att:{m.group(1)}'
    if s=='is paired with another creature': return 'pair'
    m=re.fullmatch(r"is paired with (.+)",s)
    if m: return f'pair:{m.group(1)}'
    return '?'+s
def parse(s, name):
    s=(s or '').strip()
    if not s: return ''
    bits=[part(x,name) for x in re.split(r',? and (?=(?:with|without|is|attached|untapped|tapped)\b)', s)]
    if any(b and b.startswith('?') for b in bits): return '?'+s.replace(name,'~')   # keep the whole text when any part can't be checked
    return ';'.join(b for b in bits if b)
