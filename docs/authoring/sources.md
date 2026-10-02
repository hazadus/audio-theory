# Рекомендуемые источники

Пополняемый список литературы для подготовки и дополнения материалов по [общим правилам](rules.md). Добавлять полезные источники после чтения: автор, название, ссылка и темы применения. Для конкретного утверждения проверять подходящий раздел и ссылаться на него в статье. Рекомендация не делает источник обязательным или единственным.

## Steven W. Smith — The Scientist and Engineer's Guide to Digital Signal Processing

[Книга, глава 1 и оглавление](https://www.dspguide.com/ch1.htm). Рекомендована автором проекта. Подходит для основ цифровой обработки сигналов, дискретизации, АЦП/ЦАП, представления чисел, спектрального анализа и фильтров. Выбирать главу по теме; не переносить утверждения из обзорной главы на специальные вопросы без проверки.

Прочитанные при подготовке шаблона разделы:

- [Глава 1: The Breadth and Depth of DSP](https://www.dspguide.com/ch1.htm) — область применения DSP и устройство книги.
- [Глава 3: The Sampling Theorem](https://www.dspguide.com/ch3/2.htm) — отсчёты, частота дискретизации и условия восстановления сигнала.
- [Глава 3.1: Quantization](https://www.dspguide.com/ch3/1.htm) — аналоговый сигнал как напряжение во времени; дискретизация и квантование как отдельные шаги.
- [Глава 22.1: Human Hearing](https://www.dspguide.com/ch22/1.htm) — диапазон слышимых частот, область наибольшей чувствительности, устройство уха.

Прочитанные при подготовке статьи о дискретизации разделы:

- [Глава 3.4: Analog Filters for Data Conversion](https://www.dspguide.com/ch3/4.htm) — антиалиасинговый фильтр нижних частот перед АЦП.
- [Глава 22.3: Audio Processing](https://www.dspguide.com/ch22/3.htm) — частоты дискретизации компакт-диска (44,1 кГц) и телефонной связи (8 кГц), полоса речи и музыки.

## Carl R. Nave — HyperPhysics

[Раздел о звуке](https://hyperphysics.gsu.edu/hbase/Sound/soucon.html). Справочник по физике (Georgia State University) с короткими страницами и формулами. Подходит для основ акустики: скорость звука, волновые соотношения, интенсивность и порог слышимости, микрофоны.

Прочитанные при подготовке статьи о звуковой волне страницы:

- [Speed of Sound](https://hyperphysics.gsu.edu/hbase/Sound/souspe.html) — скорость звука в сухом воздухе, приближённая зависимость от температуры, независимость от частоты и амплитуды.
- [Wave Relationship](https://hyperphysics.gsu.edu/hbase/wavrel.html) — λ = vT и v = fλ.
- [Sound Intensity](https://hyperphysics.gsu.edu/hbase/Sound/intens.html) — порог слышимости 20 мкПа, условный болевой порог.
- [Microphones](https://hyperphysics.gsu.edu/hbase/Audio/mic.html) — динамический и конденсаторный микрофоны, выходной сигнал повторяет звуковое давление.

## Julius O. Smith III — Mathematics of the Discrete Fourier Transform

[Онлайн-книга](https://ccrma.stanford.edu/~jos/mdft/) (CCRMA, Stanford University). Подходит для обозначений и математики дискретных сигналов: отсчёты, период и частота дискретизации, теорема отсчётов, ДПФ.

Прочитанные при подготовке статьи о дискретизации страницы:

- [DFT Definition](https://ccrma.stanford.edu/~jos/mdft/DFT_Definition.html) — обозначения $t_n = nT$, $f_s = 1/T$, единицы.
- [Introduction to Sampling](https://ccrma.stanford.edu/~jos/mdft/Introduction_Sampling.html) — отсчёт как число, частота компакт-диска 44 100 отсчётов в секунду.
- [Sampling Theory](https://ccrma.stanford.edu/~jos/mdft/Sampling_Theory.html) — восстановление сигнала с ограниченным спектром по отсчётам, термин Nyquist rate.

Прочитанные при подготовке раздела о наложении спектров страницы:

- [Sampling Theorem](https://ccrma.stanford.edu/~jos/mdft/Sampling_Theorem.html) — формулировка теоремы со строгим условием, восстановление через sinc, почему исключена частота $f_s/2$.
- [Aliasing of Sampled Signals](https://ccrma.stanford.edu/~jos/mdft/Aliasing_Sampled_Signals.html) — перенос частоты выше $f_s/2$, ограничения простого описания «зеркалом».

Прочитанные при подготовке статьи об уровне сигнала страницы:

- [Decibels](https://ccrma.stanford.edu/~jos/mdft/Decibels.html) — множители 20 для амплитуды и 10 для мощности, роль опорной величины.
- [Properties of dB Scales](https://ccrma.stanford.edu/~jos/mdft/Properties_DB_Scales.html) — удвоение амплитуды ≈ 6 дБ, мощности ≈ 3 дБ.
- [dB Full Scale (dBFS)](https://ccrma.stanford.edu/~jos/mdft/DB_Full_Scale_dBFS.html) — наибольшая амплитуда как опорный уровень 0 дБ.
- [Signal Metrics](https://ccrma.stanford.edu/~jos/mdft/Signal_Metrics.html) — средняя мощность, уровень RMS, мощность $A^2/2$ вещественной синусоиды.
- [Dynamic Range](https://ccrma.stanford.edu/~jos/mdft/Dynamic_Range.html) — динамический диапазон системы и сигнала.

Прочитанные при подготовке раздела о фазе страницы:

- [Sinusoids](https://ccrma.stanford.edu/~jos/mdft/Sinusoids.html) — $x(t) = A \sin(\omega t + \varphi)$, начальная фаза (phase offset) и мгновенная фаза $\omega t + \varphi$ в радианах, обычный диапазон $[-\pi, \pi)$ или $[0, 2\pi)$.
- [Sinusoids at the Same Frequency](https://ccrma.stanford.edu/~jos/mdft/Sinusoids_Same_Frequency.html) — задержка на $t_1$ меняет фазу на $\omega t_1$; сумма сдвинутых копий синусоиды — синусоида той же частоты.
- [Projection of Circular Motion](https://ccrma.stanford.edu/~jos/mdft/Projection_Circular_Motion.html) — косинус и синус как проекции равномерного движения по окружности на оси.

## Александр Радзишевский — «Звук: немного теории» (WebSound.ru)

[Статья для журнала Upgrade, февраль 2005](https://web.archive.org/web/20240416203925/http://websound.ru/articles/theory/sound-theory.htm) (веб-архив). Обзор от физики и психофизики звука до цифровых сигналов и кодеков на русском языке. Подходит как карта тем и источник русской терминологии: звуковая волна и её свойства (интерференция, дифракция, резонанс, эффект Доплера, реверберация), спектр, психоакустика, дискретизация, линейное квантование, кодирование. Статья 2005 года, числа вроде «около 330 м/с» приближённые, воспроизведение без разрешения авторов запрещено — пересказывать своими словами, конкретные значения проверять по первичным источникам выше.

Прочитанные разделы: оглавление, 2.1 «Физика звуковой волны» (волна как перенос возмущения, зависимость скорости звука от среды, независимость от частоты, интерференция и биения, дифракция, резонанс), в части цифрового звука — определения теоремы Котельникова (в зарубежной литературе Шеннона) и квантования по амплитуде, уровней и шага квантования. Разделы о психоакустике, кодеках и пространственном звуке не читались.

## Habr — Felix Arutiunyan, «Цифровое представление аналогового аудиосигнала. Краткий ликбез»

[Статья на Хабре, 25 мая 2020](https://habr.com/ru/articles/503786/). Вводный текст для начинающих с рисунками и аудиопримерами: отличие аналогового и цифрового сигнала, дискретизация и квантование, разрядность, частота дискретизации, теорема Котельникова, алиасинг, битрейт, форматы хранения. Подходит для сверки русских формулировок и расчётов (число уровней $N = 2^n$, битрейт CD $44\,100 \times 16 \times 2 = 1411{,}2$ кбит/с) и как идеи примеров для статей о дискретизации, разрядности и битрейте.

Осторожно с утверждениями: верхняя граница слуха указана непоследовательно (20 кГц и 16 кГц), объяснение 44,1 кГц через PAL/NTSC не раскрыто, пример маскировки (80 дБ на 1 кГц маскирует 40 дБ на 2 кГц) упрощён. Для таких мест брать числа из Smith и Julius O. Smith выше.

## Desmos — «Digital signal»

[Интерактивный график](https://www.desmos.com/calculator/aojmanpjrl) (автор не указан, создан в 2015). Модель оцифровки: аналоговый сигнал — сумма двух синусоид $a \sin(2\pi f x - c)$ с настраиваемыми амплитудой, частотой и фазой; ползунки частоты дискретизации и разрядности (по умолчанию 16 бит) строят точки дискретного сигнала с округлением до уровней квантования. Подходит как образец для интерактива о дискретизации, алиасинге и квантовании: при низкой частоте дискретизации и малой разрядности хорошо видны наложение и ступенчатая погрешность. Страница требует JavaScript; формулы читаются и из JSON состояния графика. Код проекта не копировать — повторять идею, а числа и формулировки проверять по первичным источникам.

## Daniel A. Russell — Acoustics and Vibration Animations

[Wave Motion in Mechanical Medium](https://www.acs.psu.edu/drussell/Demos/waves/wavemotion.html) (Penn State). Анимации продольных и поперечных волн: частицы колеблются около положения равновесия, сжатия и разрежения.

## MathWorks — Audio Toolbox: динамическая обработка

Документация MATLAB с алгоритмами в формулах; в разделах ссылки на Giannoulis, Massberg, Reiss, «Digital Dynamic Range Compressor Design — A Tutorial and Analysis», JAES 60(6), 2012 (сама статья при подготовке была недоступна: страница автора на сайте QMUL переехала, открытого PDF нет). Подходит для статической характеристики, колена, сглаживания и определений времени атаки и восстановления.

- [compressor](https://www.mathworks.com/help/audio/ref/compressor-system-object.html) — характеристика с жёстким и мягким коленом шириной W вокруг порога, сглаживание подавления с $\alpha = e^{-\ln 9/(f_s t)}$, время атаки и восстановления как переход от 10 до 90 %, автоматическая компенсация.
- [limiter](https://www.mathworks.com/help/audio/ref/limiter-system-object.html) — выход выше порога равен порогу.
- [expander](https://www.mathworks.com/help/audio/ref/expander-system-object.html) — ниже порога $y = T + (x - T) R$.
- [noiseGate](https://www.mathworks.com/help/audio/ref/noisegate-system-object.html) — нулевое усиление ниже порога, время удержания.

## W3C — Web Audio API: DynamicsCompressorNode

[Раздел спецификации](https://webaudio.github.io/web-audio-api/#DynamicsCompressorNode). Параметры компрессора браузера: колено выше порога (от T до T + knee), атака и восстановление как время изменения усиления на 10 дБ, фиксированная задержка 6 мс для взгляда вперёд, автоматическая компенсация. Полезно как пример того, что определения параметров различаются между реализациями.

## Wikipedia — DBFS и «Компрессор аудиосигнала»

[DBFS](https://en.wikipedia.org/wiki/DBFS) — 0 dBFS как наибольший цифровой уровень, соглашение AES17 (RMS синусоиды с полной амплитудой — 0 dBFS, прямоугольной волны — +3 dBFS), около 96 дБ у 16 бит; сам стандарт AES17 не читался. [Компрессор аудиосигнала](https://ru.wikipedia.org/wiki/Компрессор_аудиосигнала) — русские названия параметров (порог, степень сжатия, время атаки) и пример сжатия 2:1.

## Кривые равной громкости и слух

- [NERC Vocabulary Server. Sound pressure level in air](https://vocab.nerc.ac.uk/collection/P07/current/CFSN0309/) — прочитано определение SPL: 20 lg(p/p₀), среднеквадратичное давление, опора 2 × 10⁻⁵ Па в воздухе.

- [ISO 226:2023. Acoustics — Normal equal-loudness-level contours](https://www.iso.org/standard/83117.html) — условия сравнения чистых тонов: свободное поле, фронтальный источник, два уха, нормальный слух в возрасте 18–25 лет. Прочитан [открытый фрагмент](https://cdn.standards.iteh.ai/samples/83117/6afa5bd94e0e4f32812c28c3b0a7b8ac/ISO-226-2023.pdf): введение, разделы 1, 3 и 4, формула (1), таблица 1 и приложение A. По формуле и числовым коэффициентам построен собственный SVG; сканы и рисунки стандарта не воспроизводятся.
- [Yôiti Suzuki, Hisashi Takeshima, Kenji Kurakata. Revision of ISO 226 “Normal Equal-Loudness-Level Contours” from 2003 to 2023 edition: The background and results, 2024](https://www.jstage.jst.go.jp/article/ast/45/1/45_e23.66/_article/-char/en) — прочитаны введение и разделы 2–3: фоны, измерения Флетчера — Мансона в наушниках с пересчётом в свободное поле, история стандартизации, формула 2023 года. Лицензия статьи — CC BY-ND 4.0; её иллюстрации не изменять и не использовать для производного рисунка.
- [Audio Engineering Society. Learn More: Equal loudness contours](https://aes.org/resources/audio-topics/loudness-project/learn-more/) — прочитан одноимённый раздел: частотная чувствительность слуха, изменение формы кривых с уровнем и воспринимаемого баланса музыки.
- [Steven W. Smith. Human Hearing, глава 22](https://www.dspguide.com/ch22/1.htm) — прочитан раздел об устройстве наружного, среднего и внутреннего уха, преобразовании колебаний в нервные сигналы и частотной избирательности.
- [Roland Sottek, Thiago Lobato, Moritz Bender, Julian Becker. Modeling the ISO 226:2023 equal-loudness-level contours by standardized loudness methods, Forum Acusticum 2023](https://dael.euracoustics.org/confs/fa2023/data/articles/000585.pdf) — прочитаны разделы 2–5: пересмотр ISO 226, частотные фильтры и нелинейность слуха, сравнение моделей для чистых тонов.
