import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Home, Film, Download, X, Info, ChevronRight, ChevronLeft, AlertTriangle, Monitor, Layers, Star, Grid, List as ListIcon } from 'lucide-react';

// --- CONFIGURACIÓN ---
const TMDB_API_KEY = "342815a2b6a677bbc29fd13a6e3c1c3a"; 
const SHEET_ID = "104RB6GK9_m_nzIakTU3MJLaDJPwt9fYmfHF3ikyixFE";

const LANGUAGE_MAP = {
  'es': 'Español', 'es-es': 'Español (España)', 'es-mx': 'Español (Latino)',
  'en': 'Inglés', 'en-us': 'Inglés (EEUU)', 'en-gb': 'Inglés (Reino Unido)',
  'cat': 'Catalán', 'ca': 'Catalán', 'va': 'Valenciano',
  'fr': 'Francés', 'it': 'Italiano', 'de': 'Alemán', 'ja': 'Japonés', 'jp': 'Japonés', 'ko': 'Coreano', 'pt': 'Portugués'
};

const TMDB_GENRES = {
  28: "Acción", 12: "Aventura", 16: "Animación", 35: "Comedia", 80: "Crimen", 99: "Documental",
  18: "Drama", 10751: "Familia", 14: "Fantasía", 36: "Historia", 27: "Terror", 10402: "Música",
  9648: "Misterio", 10749: "Romance", 878: "Ciencia Ficción", 10770: "Película de TV",
  53: "Suspense", 10752: "Bélica", 37: "Western"
};

// --- UTILIDADES ---
const parseCSV = (text) => {
  const rows = [];
  let row = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && text[i + 1] === '"') { current += '"'; i++; }
    else if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { row.push(current); current = ''; }
    else if (char === '\n' && !inQuotes) { row.push(current); rows.push(row); row = []; current = ''; }
    else if (char !== '\r') { current += char; }
  }
  if (current !== '' || text[text.length - 1] === ',') row.push(current);
  if (row.length > 0) rows.push(row);
  return rows;
};

const formatVideoQuality = (raw) => {
  if (!raw) return 'SD';
  const s = raw.toLowerCase();
  if (s.includes('2160') || s.includes('4k')) return '4K';
  if (s.includes('1080') || s.includes('fhd')) return 'FHD';
  if (s.includes('720') || s.includes('hd')) return 'HD';
  return 'SD';
};

const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// --- COMPONENTE IMAGEN LAZY (Ahorro Masivo de Memoria RAM - VERSIÓN ESTRICTA) ---
const LazyImage = ({ src, alt, className }) => {
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      // Margen de 150px: la imagen no existe hasta que esté a punto de salir en pantalla
      { rootMargin: "150px" } 
    );
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={`w-full h-full bg-neutral-900 ${!isVisible ? 'animate-pulse' : ''}`}>
      {isVisible && (
        <img
          src={src}
          alt={alt}
          className={`${className} transition-opacity duration-500 opacity-0`}
          onLoad={(e) => e.target.classList.remove('opacity-0')}
          loading="lazy"
        />
      )}
    </div>
  );
};

// --- COMPONENTE FILA DE PLEX ---
const MovieRow = ({ title, items, onSelect, onCategoryClick, onTitleClick, icon, isModal = false }) => {
  const rowRef = useRef(null);
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showArrows, setShowArrows] = useState(false);
  
  // Lazy Loading para toda la fila
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Lógica inteligente para ocultar flechas si no hay suficientes películas
  useEffect(() => {
    const checkArrows = () => {
      if (rowRef.current) {
        setShowArrows(rowRef.current.scrollWidth > rowRef.current.clientWidth + 10);
      }
    };

    if (isVisible) {
      checkArrows();
      window.addEventListener('resize', checkArrows);
      const timer = setTimeout(checkArrows, 100); // Pequeño delay para asegurar renderizado
      return () => {
        window.removeEventListener('resize', checkArrows);
        clearTimeout(timer);
      };
    }
  }, [isVisible, items]);

  const scroll = (direction) => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth + 100 : scrollLeft + clientWidth - 100;
      rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  if (!items || items.length === 0) return null;

  const MAX_ITEMS = isModal ? 15 : 11;
  const displayItems = items.slice(0, MAX_ITEMS);
  const hasMore = items.length > MAX_ITEMS && !isModal;

  const cardWidthClasses = isModal 
    ? "w-24 sm:w-28 md:w-32 lg:w-36 xl:w-40" 
    : "w-28 sm:w-36 md:w-40 lg:w-48 xl:w-52 2xl:w-56";

  return (
    <div ref={containerRef} className={`${isModal ? 'mb-4' : 'mb-6 md:mb-10'} relative group/row min-h-[180px]`}>
      <h3 
        onClick={() => {
          if (onTitleClick) onTitleClick();
          else if (!isModal) onCategoryClick({title, items, icon});
        }}
        className={`${isModal ? 'text-base md:text-xl px-2' : 'text-lg md:text-2xl px-4 md:px-12'} font-bold text-gray-100 mb-0 md:mb-1 flex items-center gap-2 ${(!isModal || onTitleClick) ? 'hover:text-[#e5a00d] cursor-pointer' : ''} transition-colors w-max`}
      >
        {icon && <span className="text-[#e5a00d] mr-1">{icon}</span>}
        {title} 
        {(!isModal || onTitleClick) && <ChevronRight size={24} className="text-[#e5a00d] opacity-0 group-hover/row:opacity-100 transition-opacity" />}
      </h3>
      
      {isVisible ? (
        <>
          {showArrows && (
            <button onClick={() => scroll('left')} className="absolute left-0 top-[50%] -translate-y-1/2 z-20 bg-black/80 hover:bg-[#e5a00d] text-white p-2 md:p-4 rounded-r-xl opacity-0 group-hover/row:opacity-100 transition-all hidden md:block backdrop-blur-md border-r border-y border-white/10">
              <ChevronLeft size={28} />
            </button>
          )}
          
          {showArrows && (
            <button onClick={() => scroll('right')} className="absolute right-0 top-[50%] -translate-y-1/2 z-20 bg-black/80 hover:bg-[#e5a00d] text-white p-2 md:p-4 rounded-l-xl opacity-0 group-hover/row:opacity-100 transition-all hidden md:block backdrop-blur-md border-l border-y border-white/10">
              <ChevronRight size={28} />
            </button>
          )}

          <div ref={rowRef} className={`flex overflow-x-auto gap-3 md:gap-6 pt-3 md:pt-6 ${isModal ? 'px-2 pb-2 scroll-pl-2' : 'px-4 md:px-12 pb-4 md:pb-6 scroll-pl-4 md:scroll-pl-12'} scrollbar-hide snap-x`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {displayItems.map((item) => (
              <div key={item.id} className={`snap-start shrink-0 ${cardWidthClasses} relative cursor-pointer group transition-all duration-300 flex flex-col`} onClick={() => onSelect(item)}>
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-white/5 bg-neutral-900 shadow-lg group-hover:scale-105 group-hover:border-[#e5a00d]/50 transition-all duration-300">
                  <LazyImage src={item.image} alt={item.displayTitle || item.title} className="w-full h-full object-cover group-hover:opacity-40" />
                  
                  <div className="absolute inset-0 p-2 md:p-4 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-black via-transparent to-transparent">
                     <div className="flex flex-col gap-1 md:gap-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                        <div className="flex items-center gap-1 flex-wrap">
                            {!item.isSaga && (
                              <span className={`backdrop-blur-md text-[9px] md:text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-1 border ${item.videoQuality === '4K' ? 'bg-[#e5a00d]/90 text-black border-[#e5a00d]' : 'bg-white/20 text-white border-white/20'}`}>
                                  <Monitor size={10} /> {item.videoQuality}
                              </span>
                            )}
                            {!item.isSaga && item.rating && item.rating !== 'N/A' && item.rating !== '0.0' && (
                              <span className="backdrop-blur-md text-[9px] md:text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-1 border bg-black/60 text-[#e5a00d] border-[#e5a00d]/50">
                                  <Star size={10} fill="currentColor" /> {item.rating}
                              </span>
                            )}
                        </div>
                     </div>
                  </div>
                </div>
                <h3 className={`mt-2 md:mt-3 ${isModal ? 'text-[11px] md:text-xs' : 'text-xs md:text-sm'} font-semibold text-gray-200 line-clamp-2 leading-normal pb-1 pr-1 group-hover:text-[#e5a00d] transition-colors`}>{item.displayTitle || item.title}</h3>
                {!item.isSaga && <div className="text-[10px] md:text-xs text-gray-500 font-medium">{item.year}</div>}
                {item.isSaga && <div className="text-[10px] md:text-xs text-[#e5a00d] font-medium tracking-wide">COLECCIÓN</div>}
              </div>
            ))}

            {hasMore && (
              <div 
                className={`snap-start shrink-0 ${cardWidthClasses} relative cursor-pointer group transition-all duration-300 flex flex-col`} 
                onClick={() => onCategoryClick({title, items, icon})}
              >
                <div className="relative aspect-[2/3] w-full rounded-lg border border-white/10 bg-neutral-900/40 hover:bg-neutral-800 transition-all duration-300 flex flex-col items-center justify-center gap-2 md:gap-3 text-gray-400 hover:text-[#e5a00d] shadow-lg">
                   <div className="p-3 md:p-4 rounded-full bg-black/40 group-hover:scale-110 transition-transform">
                     <Grid size={28} className="md:w-8 md:h-8" />
                   </div>
                   <span className="font-bold text-xs md:text-sm text-center px-2">Ver todos ({items.length})</span>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className={`flex gap-3 md:gap-6 pt-3 md:pt-6 ${isModal ? 'px-2' : 'px-4 md:px-12'} overflow-hidden`}>
           {[...Array(6)].map((_, i) => (
             <div key={i} className={`shrink-0 ${cardWidthClasses} aspect-[2/3] bg-neutral-900/40 rounded-lg animate-pulse`}></div>
           ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [items, setItems] = useState([]);
  const [sagas, setSagas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [heroItem, setHeroItem] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); 

  // --- FAVICON PERSONALIZADO (Añadido) ---
  useEffect(() => {
    document.title = "ElPepeStreams";
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    // Icono dinámico de unas palomitas
    link.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍿</text></svg>";
  }, []);

  const translateLangs = (str) => {
    if (!str || str === 'N/A') return 'N/A';
    return str.split(/[,/-]/).map(l => {
      const clean = l.trim().toLowerCase();
      return LANGUAGE_MAP[clean] || l.trim();
    }).join(', ');
  };

  const fetchTMDB = async (title, year) => {
    try {
      let cleanTitle = title
        .replace(/\[.*?\]/g, ' ') 
        .replace(/\(.*?\)/g, ' ') 
        .replace(/[\[\]\(\)]/g, '') 
        .replace(/!/g, '') 
        .replace(/\s1$/, '') 
        .trim();
        
      const query = encodeURIComponent(cleanTitle);
      const cleanYear = year ? year.toString().match(/\d{4}/)?.[0] : '';
      
      let searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${query}&language=es-ES&primary_release_year=${cleanYear || ''}`;
      let res = await fetch(searchUrl);
      let data = await res.json();
      
      if ((!data.results || data.results.length === 0) && cleanYear) {
         searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${query}&language=es-ES`;
         res = await fetch(searchUrl);
         data = await res.json();
      }

      if ((!data.results || data.results.length === 0) && cleanTitle.match(/[:\-]/)) {
         const shortTitle = cleanTitle.split(/[:\-]/)[0].trim();
         searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(shortTitle)}&language=es-ES&primary_release_year=${cleanYear || ''}`;
         res = await fetch(searchUrl);
         data = await res.json();
      }

      if ((!data.results || data.results.length === 0) && cleanTitle.split(' ').length > 2) {
         const ultraShort = cleanTitle.split(' ').slice(0, 2).join(' ');
         searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(ultraShort)}&language=es-ES&primary_release_year=${cleanYear || ''}`;
         res = await fetch(searchUrl);
         data = await res.json();
      }
      
      if (data.results?.[0]) {
        const tmdbId = data.results[0].id;
        const detailUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-ES`;
        const detailRes = await fetch(detailUrl);
        const movie = await detailRes.json();

        let collectionData = null;
        if (movie.belongs_to_collection) {
            collectionData = {
                id: movie.belongs_to_collection.id,
                name: movie.belongs_to_collection.name,
                poster: movie.belongs_to_collection.poster_path ? `https://image.tmdb.org/t/p/w500${movie.belongs_to_collection.poster_path}` : null,
                backdrop: movie.belongs_to_collection.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.belongs_to_collection.backdrop_path}` : null,
            };
        }

        return {
          overview: movie.overview,
          poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
          backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
          year: movie.release_date?.split('-')[0],
          genres: movie.genres?.map(g => g.name) || movie.genre_ids?.map(id => TMDB_GENRES[id]).filter(Boolean) || [],
          collection: collectionData,
          rating: movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'
        };
      }
    } catch (e) { console.warn("TMDB Error:", e); }
    return null;
  };

  const fetchContent = async () => {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;
      const response = await fetch(url);
      const csvText = await response.text();
      
      const parsedData = parseCSV(csvText);
      const headers = parsedData[0].map(h => (h || '').toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      const getIdx = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));

      const idxTitle = getIdx(['titulo', 'title']);
      const idxYear = getIdx(['ano', 'year', 'año']);
      const idxLang = getIdx(['idioma', 'lenguaje']);
      const idxQual = getIdx(['calidad']);
      const idxGen  = getIdx(['genero', 'género']);
      
      const idxLink = 8; 

      const rawRows = parsedData.slice(1).filter(r => r[idxTitle]);

      const chunkSize = 15;
      const enriched = [];
      
      for (let i = 0; i < rawRows.length; i += chunkSize) {
        const chunk = rawRows.slice(i, i + chunkSize);
        const chunkEnriched = await Promise.all(chunk.map(async (row, idx) => {
          const title = row[idxTitle];
          const year = idxYear !== -1 ? row[idxYear] : '';
          const tmdb = await fetchTMDB(title, year);
          
          let finalLink = row.length > idxLink ? row[idxLink].trim() : '#';
          if (!finalLink || finalLink.toLowerCase() === 'link') finalLink = '#';
          else if (finalLink !== '#' && !finalLink.startsWith('http')) finalLink = 'https://' + finalLink;

          return {
            id: `item-${i + idx}`,
            isSaga: false,
            title,
            year: tmdb?.year || year || '?',
            description: tmdb?.overview || "Sin descripción disponible.",
            image: tmdb?.poster || `https://via.placeholder.com/500x750/1a1a1c/e5a00d?text=${encodeURIComponent(title)}`,
            backdrop: tmdb?.backdrop || tmdb?.poster,
            videoQuality: formatVideoQuality(idxQual !== -1 ? row[idxQual] : ''),
            language: idxLang !== -1 ? translateLangs(row[idxLang]) : 'N/A',
            link: finalLink,
            genres: tmdb?.genres?.length ? tmdb.genres : (idxGen !== -1 && row[idxGen] ? [row[idxGen]] : ["Otros"]),
            collection: tmdb?.collection || null,
            rating: tmdb?.rating || 'N/A'
          };
        }));
        enriched.push(...chunkEnriched);
      }

      const sagaMap = new Map();
      enriched.forEach(item => {
          if (item.collection) {
              if (!sagaMap.has(item.collection.id)) {
                  sagaMap.set(item.collection.id, {
                      isSaga: true,
                      id: `saga-${item.collection.id}`,
                      title: item.collection.name,
                      displayTitle: item.collection.name,
                      image: item.collection.poster || item.image,
                      backdrop: item.collection.backdrop || item.backdrop,
                      movies: [],
                      genres: item.genres 
                  });
              }
              sagaMap.get(item.collection.id).movies.push(item);
          }
      });
      
      const sagasArray = Array.from(sagaMap.values());
      sagasArray.forEach(saga => {
          saga.movies.sort((a, b) => parseInt(a.year || 0) - parseInt(b.year || 0));
      });

      setItems(enriched);
      setSagas(sagasArray);
      
      if (enriched.length > 0) {
          const topMovies = enriched.filter(m => parseFloat(m.rating) > 7.0);
          const pool = topMovies.length > 0 ? topMovies : enriched;
          setHeroItem(pool[Math.floor(Math.random() * pool.length)]);
      }

      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
     if (searchQuery) {
         setSelectedCategory(null);
         window.scrollTo({ top: 0, behavior: 'smooth' });
     }
  }, [searchQuery]);

  useEffect(() => {
     if (selectedCategory) {
         window.scrollTo({ top: 0, behavior: 'smooth' });
     }
  }, [selectedCategory]);

  const categories = useMemo(() => {
    if (searchQuery) return [];
    
    let cats = [];

    cats.push({ title: 'Recomendados de hoy', items: shuffleArray(items), icon: <Star size={22}/> });

    const topRated = [...items].sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0));
    cats.push({ title: 'Mejor Valoradas', items: topRated, icon: null });

    if (sagas.length > 0) {
        cats.push({ title: 'Sagas y Colecciones', items: shuffleArray(sagas), icon: <Layers size={22}/> });
    }

    const allGenres = [...new Set(items.flatMap(i => i.genres))].sort();
    let genreCats = [];
    allGenres.forEach(g => {
      const filtered = items.filter(i => i.genres.includes(g));
      if (filtered.length > 2) genreCats.push({ title: g, items: shuffleArray(filtered), icon: null });
    });

    genreCats = shuffleArray(genreCats);

    return [...cats, ...genreCats];
  }, [items, sagas, searchQuery]);

  const filteredItems = items.filter(i => 
    i.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    i.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sagaItems = useMemo(() => {
     if (!selectedItem || selectedItem.isSaga || !selectedItem.collection) return [];
     return items.filter(i => !i.isSaga && i.collection?.id === selectedItem.collection.id && i.id !== selectedItem.id);
  }, [selectedItem, items]);

  const renderGridOrList = (arrayToRender) => {
    if (viewMode === 'list') {
      return (
        <div className="flex flex-col gap-3 md:gap-4 w-full max-w-5xl">
          {arrayToRender.map(item => (
            <div key={item.id} className="group cursor-pointer flex gap-4 md:gap-6 bg-neutral-900/30 hover:bg-neutral-800/60 border border-white/5 rounded-xl p-3 md:p-4 transition-all" onClick={() => setSelectedItem(item)}>
               <div className="w-20 md:w-28 shrink-0 aspect-[2/3] rounded-lg overflow-hidden shadow-lg group-hover:scale-105 transition-transform">
                 <LazyImage src={item.image} alt={item.title} className="w-full h-full object-cover" />
               </div>
               <div className="flex flex-col justify-center flex-1">
                 <h4 className="font-bold text-sm md:text-xl text-white mb-1 md:mb-2 group-hover:text-[#e5a00d] transition-colors">{item.displayTitle || item.title}</h4>
                 {!item.isSaga && (
                   <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs md:text-sm text-gray-400 mb-2 md:mb-3">
                     <span className="font-bold text-white">{item.year}</span>
                     {item.rating && item.rating !== 'N/A' && <span className="flex items-center gap-1 text-[#e5a00d]"><Star size={12} fill="currentColor"/> {item.rating}</span>}
                     {item.videoQuality && <span className="border border-gray-600 px-1.5 py-0.5 rounded text-[10px] md:text-xs">{item.videoQuality}</span>}
                     <span className="hidden sm:inline">•</span>
                     <span className="hidden sm:inline">{item.genres.join(', ')}</span>
                   </div>
                 )}
                 {item.isSaga && <div className="text-xs md:text-sm text-[#e5a00d] font-bold tracking-widest mb-2 uppercase">Colección</div>}
                 <p className="text-xs md:text-sm text-gray-500 line-clamp-2 md:line-clamp-3">{item.description}</p>
               </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 md:gap-6">
        {arrayToRender.map(item => (
          <div key={item.id} className="group cursor-pointer flex flex-col" onClick={() => setSelectedItem(item)}>
            <div className="aspect-[2/3] rounded-lg overflow-hidden border border-white/5 bg-neutral-900 group-hover:scale-105 transition-transform duration-300 shadow-xl">
              <LazyImage src={item.image} alt={item.title} className="w-full h-full object-cover" />
            </div>
            <h4 className="mt-2 md:mt-3 font-bold text-[11px] md:text-sm line-clamp-2 leading-normal pb-1 pr-1 group-hover:text-[#e5a00d] transition-colors">{item.displayTitle || item.title}</h4>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-gray-200 font-sans selection:bg-[#e5a00d] selection:text-black pb-20 overflow-x-hidden">
      
      <style>{`
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: #0f0f0f; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 5px; }
        ::-webkit-scrollbar-thumb:hover { background: #e5a00d; }
      `}</style>

      {/* --- NAVBAR RESPONSIVO --- */}
      <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${isScrolled ? 'bg-[#141414]/95 backdrop-blur-md shadow-2xl' : 'bg-gradient-to-b from-black/90 to-transparent'}`}>
        <div className="px-4 md:px-12 py-3 md:py-5 flex flex-col sm:flex-row items-center justify-between gap-3 md:gap-10">
          
          <div className="flex w-full sm:w-auto items-center justify-between gap-6 md:gap-10">
            <div className="flex items-center gap-1 text-[#e5a00d] font-black text-2xl md:text-3xl tracking-tighter cursor-pointer" onClick={() => {setSearchQuery(""); setSelectedCategory(null);}}>
              <ChevronRight size={28} className="-mr-2 md:-mr-3" />
              <span>ElPepe<span className="text-white font-light">Streams</span></span>
            </div>
            <button onClick={() => {setSearchQuery(""); setSelectedCategory(null);}} className="hidden md:flex items-center gap-2 text-white hover:text-[#e5a00d] transition-colors font-bold tracking-wide">
              <Home size={20} /> INICIO
            </button>
          </div>

          <div className="relative group w-full sm:flex-1 sm:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#e5a00d] transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Buscar películas..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-neutral-900/60 border border-white/10 rounded-full py-2.5 pl-10 md:pl-12 pr-4 md:pr-6 w-full focus:outline-none focus:border-[#e5a00d] focus:bg-black transition-all text-xs md:text-sm backdrop-blur-sm"
            />
          </div>

        </div>
      </nav>

      {loading ? (
        <div className="h-screen flex flex-col items-center justify-center gap-5">
          <div className="w-12 h-12 border-4 border-[#e5a00d] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium animate-pulse">Sincronizando con tu biblioteca...</p>
        </div>
      ) : error ? (
        <div className="h-screen flex flex-col items-center justify-center text-center p-10">
          <AlertTriangle size={60} className="text-red-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Vaya, algo ha fallado</h2>
          <p className="text-gray-400">{error}</p>
        </div>
      ) : (
        <>
          {heroItem && !searchQuery && !selectedCategory && (
            <div className="relative h-[60vh] sm:h-[70vh] md:h-[85vh] w-full mb-8 md:mb-12 overflow-hidden mt-14 sm:mt-0">
               <img src={heroItem.backdrop} className="w-full h-full object-cover" alt="Hero" />
               <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f0f] via-[#0f0f0f]/80 md:via-[#0f0f0f]/60 to-transparent"></div>
               <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-transparent to-transparent"></div>
               <div className="absolute bottom-10 md:bottom-20 left-6 md:left-12 max-w-[90%] md:max-w-3xl z-10">
                  <div className="flex items-center gap-2 text-[#e5a00d] font-bold text-[10px] md:text-xs uppercase tracking-[0.2em] mb-3 md:mb-4">
                    <Film size={14} /> RECOMENDADO PARA TI
                  </div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white mb-2 md:mb-4 leading-snug pb-2 drop-shadow-2xl line-clamp-2 md:line-clamp-3 break-words pr-4">{heroItem.title}</h1>
                  <p className="text-gray-300 text-xs sm:text-sm md:text-base lg:text-lg line-clamp-2 md:line-clamp-3 font-light mb-4 md:mb-6 max-w-xl leading-relaxed">{heroItem.description}</p>
                  <button onClick={() => setSelectedItem(heroItem)} className="flex items-center gap-2 md:gap-3 bg-[#e5a00d] hover:bg-[#c9890a] text-black font-extrabold py-2 md:py-3 px-6 md:px-8 rounded-full transition-all hover:scale-105 shadow-2xl shadow-[#e5a00d]/20 w-max text-xs md:text-base">
                    <Info size={20} className="md:w-6 md:h-6" /> VER DETALLES
                  </button>
               </div>
            </div>
          )}

          <div className={searchQuery || selectedCategory ? 'pt-32 md:pt-36 px-4 md:px-12' : '-mt-10 md:-mt-24 relative z-20'}>
            
            {searchQuery ? (
               <div>
                 <div className="flex items-center justify-between mb-6 md:mb-8">
                    <h2 className="text-xl md:text-3xl font-bold text-white">Resultados de búsqueda</h2>
                    <div className="flex items-center gap-1 md:gap-2 bg-neutral-900/80 p-1 rounded-lg border border-white/5">
                      <button onClick={() => setViewMode('grid')} className={`p-1.5 md:p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-[#e5a00d] text-black shadow' : 'text-gray-400 hover:text-white'}`}><Grid size={16} className="md:w-5 md:h-5" /></button>
                      <button onClick={() => setViewMode('list')} className={`p-1.5 md:p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[#e5a00d] text-black shadow' : 'text-gray-400 hover:text-white'}`}><ListIcon size={16} className="md:w-5 md:h-5" /></button>
                    </div>
                 </div>
                 {renderGridOrList(filteredItems)}
               </div>
            ) : selectedCategory ? (
               <div className="animate-in fade-in duration-300">
                 <button onClick={() => setSelectedCategory(null)} className="flex items-center gap-2 text-gray-400 hover:text-[#e5a00d] mb-4 md:mb-8 transition-colors text-sm font-semibold">
                   <ChevronLeft size={20} /> VOLVER
                 </button>
                 
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
                   <h2 className="text-2xl md:text-4xl font-black text-white flex items-center gap-3 tracking-tight">
                     {selectedCategory.icon && <span className="text-[#e5a00d]">{selectedCategory.icon}</span>}
                     {selectedCategory.title}
                   </h2>
                   
                   <div className="flex items-center gap-1 md:gap-2 bg-neutral-900/80 p-1 rounded-lg border border-white/5 w-max">
                     <button onClick={() => setViewMode('grid')} className={`p-1.5 md:p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-[#e5a00d] text-black shadow' : 'text-gray-400 hover:text-white'}`}><Grid size={16} className="md:w-5 md:h-5" /></button>
                     <button onClick={() => setViewMode('list')} className={`p-1.5 md:p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[#e5a00d] text-black shadow' : 'text-gray-400 hover:text-white'}`}><ListIcon size={16} className="md:w-5 md:h-5" /></button>
                   </div>
                 </div>

                 {renderGridOrList(selectedCategory.items)}
               </div>
            ) : (
               categories.map((cat, idx) => (
                   <MovieRow 
                       key={idx} 
                       title={cat.title} 
                       items={cat.items} 
                       onSelect={setSelectedItem} 
                       onCategoryClick={setSelectedCategory}
                       icon={cat.icon} 
                   />
               ))
            )}
          </div>
        </>
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="absolute inset-0" onClick={() => setSelectedItem(null)}></div>
          
          <div className="bg-[#1a1a1c] w-full h-full md:h-auto md:max-w-6xl md:rounded-2xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] relative flex flex-col sm:flex-row max-h-[100vh] sm:max-h-[95vh] border-0 md:border border-white/10 animate-in zoom-in-95 duration-300">
            
            <button onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 md:top-6 md:right-6 z-50 p-2 bg-black/50 hover:bg-[#e5a00d] text-white hover:text-black rounded-full transition-all">
              <X size={24} />
            </button>

            <div className="w-full sm:w-[250px] md:w-[300px] lg:w-[400px] relative shrink-0 h-[35vh] sm:h-auto bg-black">
                <img src={selectedItem.image} className="w-full h-full object-contain sm:object-cover" alt="Poster" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1c] via-transparent to-transparent sm:bg-gradient-to-r sm:from-transparent sm:via-[#1a1a1c]/40 sm:to-[#1a1a1c]"></div>
            </div>

            <div className="flex-1 p-6 md:p-10 lg:p-12 flex flex-col overflow-y-auto">
                
                {selectedItem.isSaga ? (
                    <div className="flex flex-col flex-1">
                        <div className="text-[#e5a00d] font-bold text-xs md:text-sm mb-2 flex items-center gap-1 uppercase tracking-widest"><Layers size={14}/> Colección Oficial</div>
                        <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-6 leading-snug pb-2">{selectedItem.title}</h2>
                        
                        <p className="text-gray-400 text-sm md:text-base lg:text-lg font-light leading-relaxed mb-8">Esta es una colección que agrupa varias películas de tu biblioteca. Selecciona la película que deseas ver o descargar.</p>
                        
                        <div className="mt-4 flex flex-col gap-8 shrink-0 pb-4">
                           <div className="w-full">
                              <h4 className="text-white font-bold text-sm md:text-base mb-4 border-b border-white/10 pb-2">Películas en tu biblioteca ({selectedItem.movies.length})</h4>
                              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                                 {selectedItem.movies.map(movie => (
                                    <div key={movie.id} className="cursor-pointer group flex flex-col" onClick={() => setSelectedItem(movie)}>
                                       <div className="aspect-[2/3] rounded-md overflow-hidden relative shadow-lg">
                                           <LazyImage src={movie.image} alt={movie.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                       </div>
                                       <p className="text-[11px] md:text-xs font-semibold text-gray-200 mt-2 line-clamp-2 leading-normal pb-1 group-hover:text-[#e5a00d]">{movie.title}</p>
                                       <p className="text-[9px] md:text-[10px] text-gray-500">{movie.year}</p>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col flex-1">
                        <div className="flex flex-wrap gap-2 mb-3">
                          {selectedItem.genres.map(g => (
                            <span key={g} className="text-[#e5a00d] text-[10px] md:text-xs font-black uppercase tracking-widest">{g}</span>
                          ))}
                        </div>
                        
                        {selectedItem.collection && (
                            <div className="text-gray-400 font-bold text-xs md:text-sm mb-2 flex items-center gap-1 cursor-pointer hover:text-white transition-colors" onClick={() => setSelectedItem(sagas.find(s => s.id === `saga-${selectedItem.collection.id}`))}>
                                <Layers size={14}/> {selectedItem.collection.name} <ChevronRight size={14}/>
                            </div>
                        )}

                        <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-6 leading-snug pb-2">{selectedItem.title}</h2>
                        
                        <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-6">
                          <div className="flex flex-col">
                            <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Año</span>
                            <span className="text-white font-bold">{selectedItem.year}</span>
                          </div>
                          <div className="w-px h-6 md:h-8 bg-white/10 mx-1 md:mx-2"></div>
                          
                          <div className="flex flex-col">
                            <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-tighter">TMDB</span>
                            <span className="text-white font-bold flex items-center gap-1"><Star size={14} className="text-[#e5a00d]" fill="currentColor"/> {selectedItem.rating}</span>
                          </div>
                          <div className="w-px h-6 md:h-8 bg-white/10 mx-1 md:mx-2"></div>

                          <div className="flex flex-col">
                            <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Calidad</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] md:text-[11px] font-black mt-1 uppercase border ${selectedItem.videoQuality === '4K' ? 'bg-[#e5a00d] text-black border-[#e5a00d]' : 'bg-white/10 text-white border-white/20'}`}>
                                {selectedItem.videoQuality}
                            </span>
                          </div>
                          <div className="w-px h-6 md:h-8 bg-white/10 mx-1 md:mx-2"></div>
                          <div className="flex flex-col">
                            <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Idiomas</span>
                            <span className="text-gray-300 font-medium text-xs md:text-sm mt-1">{selectedItem.language}</span>
                          </div>
                        </div>

                        <p className="text-gray-400 text-sm md:text-base lg:text-lg font-light leading-relaxed mb-8">{selectedItem.description}</p>
                        
                        {selectedItem.link !== '#' ? (
                           <a href={selectedItem.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 bg-[#e5a00d] hover:bg-[#c9890a] text-black font-black py-4 px-6 md:px-10 rounded-full text-sm md:text-lg transition-all hover:scale-105 shadow-xl shadow-[#e5a00d]/10 w-full md:w-max group shrink-0">
                             <Download size={22} className="group-hover:translate-y-1 transition-transform" /> DESCARGAR A MI BIBLIOTECA
                           </a>
                        ) : (
                           <button disabled className="flex items-center justify-center gap-3 bg-neutral-800 text-gray-500 font-black py-4 px-6 md:px-10 rounded-full text-sm md:text-lg cursor-not-allowed w-full md:w-max shrink-0">
                             <AlertTriangle size={22} /> ENLACE NO DISPONIBLE
                           </button>
                        )}

                        <div className="mt-12 flex flex-col gap-2 shrink-0 pb-4">
                           {/* Mismo formato de la portada para sagas y similares. onClick enlaza a la colección */}
                           {sagaItems.length > 0 && (
                              <MovieRow 
                                  title="Más de esta saga" 
                                  items={sagaItems} 
                                  onSelect={setSelectedItem} 
                                  icon={<Layers size={18} />} 
                                  isModal={true}
                                  onTitleClick={() => setSelectedItem(sagas.find(s => s.id === `saga-${selectedItem.collection.id}`))}
                              />
                           )}

                           {items.filter(i => !i.isSaga && i.id !== selectedItem.id && i.genres.some(g => selectedItem.genres.includes(g))).length > 0 && (
                              <MovieRow 
                                  title="Títulos similares recomendados" 
                                  items={shuffleArray(items.filter(i => !i.isSaga && i.id !== selectedItem.id && i.genres.some(g => selectedItem.genres.includes(g))))} 
                                  onSelect={setSelectedItem} 
                                  icon={<Star size={18} />} 
                                  isModal={true}
                              />
                           )}
                        </div>
                    </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}