from pathlib import Path
from PIL import Image

folder = Path(__file__).resolve().parent
tarot = folder.parents[1] / '塔罗牌卡面'
for label, name in [('梅花', 'club-reference'), ('黑桃', 'spade-reference')]:
    image = Image.open(tarot / f'四花色样板/大图/{label}.png').convert('RGB')
    image.thumbnail((465, 650), Image.Resampling.LANCZOS)
    image.save(folder / f'{name}.jpg', quality=85)
    print(name, image.size, (folder / f'{name}.jpg').stat().st_size)
