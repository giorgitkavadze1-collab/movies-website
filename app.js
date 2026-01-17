const API_KEY = '8e530280';
const API_URL = 'https://www.omdbapi.com/';

let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let currentFilter = 'all';
let searchTimeout = null;

const trendingSearches = {
    movies: ['Avengers', 'Batman', 'Star Wars', 'Marvel', 'Spider-Man', 'Superman'],
    series: ['Breaking Bad', 'Game of Thrones', 'Stranger Things', 'The Office', 'Friends']
};

const categorySearches = {
    action: ['Mission Impossible', 'Fast Furious', 'John Wick', 'Mad Max'],
    comedy: ['Hangover', 'Step Brothers', 'Superbad', 'Anchorman'],
    drama: ['Godfather', 'Shawshank', 'Forrest Gump', 'Fight Club'],
    horror: ['Conjuring', 'Insidious', 'Scream', 'Halloween'],
    'sci-fi': ['Matrix', 'Blade Runner', 'Inception', 'Interstellar'],
    romance: ['Titanic', 'Notebook', 'La La Land', 'Before Sunrise'],
    thriller: ['Seven', 'Prestige', 'Shutter Island', 'Gone Girl'],
    animation: ['Toy Story', 'Spirited Away', 'Frozen', 'Lion King']
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    loadTrendingMovies();
    updateFavoritesDisplay();
});

function initializeApp() {
    window.addEventListener('scroll', () => {
        const header = document.querySelector('.header');
        if (window.scrollY > 100) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                });
                this.classList.add('active');
            }
        });
    });
}

function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    searchBtn.addEventListener('click', () => performSearch());
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length >= 3) {
            searchTimeout = setTimeout(() => {
                fetchSearchSuggestions(query);
            }, 500);
        } else {
            hideSuggestions();
        }
    });

    document.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', () => {
            const category = card.dataset.category;
            loadCategoryMovies(category);
        });
    });

    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            loadTrendingMovies();
        });
    });

    document.querySelector('.modal-close').addEventListener('click', closeModal);
    document.querySelector('.modal-overlay').addEventListener('click', closeModal);

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            hideSuggestions();
        }
    });
}

async function fetchFromAPI(params) {
    try {
        const url = `${API_URL}?apikey=${API_KEY}&${params}`;
        const response = await fetch(url);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

async function fetchMovieById(id) {
    return await fetchFromAPI(`i=${id}&plot=full`);
}

async function searchMovies(query, type = '') {
    const typeParam = type ? `&type=${type}` : '';
    return await fetchFromAPI(`s=${encodeURIComponent(query)}${typeParam}`);
}

async function performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    const resultsSection = document.getElementById('searchResults');
    const resultsGrid = document.getElementById('resultsGrid');
    const noResults = document.getElementById('noResults');

    resultsSection.style.display = 'block';
    resultsGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Searching...</p></div>';
    noResults.style.display = 'none';

    resultsSection.scrollIntoView({ behavior: 'smooth' });

    const data = await searchMovies(query);

    if (data && data.Response === 'True') {
        displayMovies(resultsGrid, data.Search);
    } else {
        resultsGrid.innerHTML = '';
        noResults.style.display = 'block';
    }

    hideSuggestions();
}

async function fetchSearchSuggestions(query) {
    const data = await searchMovies(query);
    const suggestionsContainer = document.getElementById('searchSuggestions');

    if (data && data.Response === 'True' && data.Search) {
        const suggestions = data.Search.slice(0, 5);
        let html = '';

        suggestions.forEach(movie => {
            html += `
                <div class="suggestion-item" onclick="selectSuggestion('${movie.imdbID}', '${movie.Title.replace(/'/g, "\\'")}')">
                    <img src="${movie.Poster !== 'N/A' ? movie.Poster : 'https://via.placeholder.com/50x75?text=No+Image'}" 
                         alt="${movie.Title}" 
                         class="suggestion-poster"
                         onerror="this.src='https://via.placeholder.com/50x75?text=No+Image'">
                    <div class="suggestion-info">
                        <h4>${movie.Title}</h4>
                        <p>${movie.Year} • ${movie.Type}</p>
                    </div>
                </div>
            `;
        });

        suggestionsContainer.innerHTML = html;
        suggestionsContainer.classList.add('active');
    } else {
        hideSuggestions();
    }
}

function selectSuggestion(imdbID, title) {
    document.getElementById('searchInput').value = title;
    hideSuggestions();
    openMovieModal(imdbID);
}

function hideSuggestions() {
    const suggestionsContainer = document.getElementById('searchSuggestions');
    suggestionsContainer.classList.remove('active');
    suggestionsContainer.innerHTML = '';
}

async function loadTrendingMovies() {
    const container = document.getElementById('trendingMovies');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Loading movies...</p></div>';

    let searchQueries = [];
    let searchType = '';
    
    if (currentFilter === 'all' || currentFilter === 'movie') {
        searchQueries = trendingSearches.movies;
        searchType = 'movie';
    } else if (currentFilter === 'series') {
        searchQueries = trendingSearches.series;
        searchType = 'series';
    }

    const allResults = await Promise.all(
        searchQueries.map(query => searchMovies(query, searchType))
    );

    // Flatten and deduplicate results
    const uniqueMovies = new Map();
    allResults.forEach(data => {
        if (data && data.Response === 'True' && data.Search) {
            data.Search.forEach(movie => {
                if (!uniqueMovies.has(movie.imdbID)) {
                    uniqueMovies.set(movie.imdbID, movie);
                }
            });
        }
    });

    const movies = Array.from(uniqueMovies.values()).slice(0, 12);
    displayMovies(container, movies);
}

async function loadCategoryMovies(category) {
    const resultsSection = document.getElementById('searchResults');
    const resultsGrid = document.getElementById('resultsGrid');
    
    resultsSection.style.display = 'block';
    resultsGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Loading...</p></div>';
    
    document.querySelector('#searchResults .section-title').textContent = `${category.charAt(0).toUpperCase() + category.slice(1)} Movies`;
    
    resultsSection.scrollIntoView({ behavior: 'smooth' });

    const searchQueries = categorySearches[category] || [];
    const allResults = await Promise.all(
        searchQueries.map(query => searchMovies(query, 'movie'))
    );

    // Flatten and deduplicate results
    const uniqueMovies = new Map();
    allResults.forEach(data => {
        if (data && data.Response === 'True' && data.Search) {
            data.Search.forEach(movie => {
                if (!uniqueMovies.has(movie.imdbID)) {
                    uniqueMovies.set(movie.imdbID, movie);
                }
            });
        }
    });

    const movies = Array.from(uniqueMovies.values()).slice(0, 12);
    displayMovies(resultsGrid, movies);
}

function displayMovies(container, movies) {
    if (!movies || movies.length === 0) {
        container.innerHTML = '<div class="no-results"><i class="fas fa-film"></i><h3>No movies found</h3></div>';
        return;
    }

    let html = '';
    movies.forEach(movie => {
        const isFavorite = favorites.some(fav => fav.imdbID === movie.imdbID);
        const rating = movie.imdbRating !== 'N/A' ? movie.imdbRating : 'N/A';
        
        html += `
            <div class="movie-card" data-id="${movie.imdbID}">
                <button class="favorite-btn ${isFavorite ? 'active' : ''}" 
                        onclick="toggleFavorite(event, '${movie.imdbID}')">
                    <i class="fas fa-heart"></i>
                </button>
                <img src="${movie.Poster !== 'N/A' ? movie.Poster : 'https://via.placeholder.com/250x400?text=No+Poster'}" 
                     alt="${movie.Title}" 
                     class="movie-poster"
                     onerror="this.src='https://via.placeholder.com/250x400?text=No+Poster'"
                     onclick="openMovieModal('${movie.imdbID}')">
                <div class="movie-info" onclick="openMovieModal('${movie.imdbID}')">
                    <h3 class="movie-title">${movie.Title}</h3>
                    <div class="movie-meta">
                        <span class="movie-year">
                            <i class="fas fa-calendar"></i> ${movie.Year}
                        </span>
                        <span class="movie-rating">
                            <i class="fas fa-star"></i> ${rating}
                        </span>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function openMovieModal(imdbID) {
    const modal = document.getElementById('movieModal');
    const modalBody = document.getElementById('modalBody');

    modal.classList.add('active');
    modalBody.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Loading details...</p></div>';

    const movie = await fetchMovieById(imdbID);

    if (movie && movie.Response === 'True') {
        const isFavorite = favorites.some(fav => fav.imdbID === movie.imdbID);
        
        modalBody.innerHTML = `
            <div class="modal-header">
                <img src="${movie.Poster !== 'N/A' ? movie.Poster : 'https://via.placeholder.com/900x400?text=No+Image'}" 
                     alt="${movie.Title}" 
                     class="modal-backdrop"
                     onerror="this.src='https://via.placeholder.com/900x400?text=No+Image'">
            </div>
            <div class="modal-details">
                <h2 class="modal-title">${movie.Title}</h2>
                <div class="modal-meta">
                    <span class="meta-item"><i class="fas fa-calendar"></i> ${movie.Year}</span>
                    <span class="meta-item"><i class="fas fa-clock"></i> ${movie.Runtime}</span>
                    <span class="meta-item"><i class="fas fa-film"></i> ${movie.Genre}</span>
                    ${movie.imdbRating !== 'N/A' ? `<span class="modal-rating"><i class="fas fa-star"></i> ${movie.imdbRating}/10</span>` : ''}
                </div>
                <p class="modal-plot">${movie.Plot}</p>
                <div class="modal-info-grid">
                    <div class="info-item">
                        <h4>Director</h4>
                        <p>${movie.Director}</p>
                    </div>
                    <div class="info-item">
                        <h4>Writers</h4>
                        <p>${movie.Writer}</p>
                    </div>
                    <div class="info-item">
                        <h4>Actors</h4>
                        <p>${movie.Actors}</p>
                    </div>
                    <div class="info-item">
                        <h4>Language</h4>
                        <p>${movie.Language}</p>
                    </div>
                    <div class="info-item">
                        <h4>Country</h4>
                        <p>${movie.Country}</p>
                    </div>
                    <div class="info-item">
                        <h4>Awards</h4>
                        <p>${movie.Awards}</p>
                    </div>
                </div>
                <button class="search-btn" style="margin-top: 2rem;" onclick="toggleFavorite(event, '${movie.imdbID}', true)">
                    <i class="fas fa-heart"></i> ${isFavorite ? 'Remove from' : 'Add to'} Favorites
                </button>
            </div>
        `;
    }
}

function closeModal() {
    const modal = document.getElementById('movieModal');
    modal.classList.remove('active');
}

async function toggleFavorite(event, imdbID, updateModal = false) {
    event.stopPropagation();
    
    const index = favorites.findIndex(fav => fav.imdbID === imdbID);
    
    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        const movie = await fetchMovieById(imdbID);
        if (movie && movie.Response === 'True') {
            favorites.push(movie);
        }
    }
    
    localStorage.setItem('favorites', JSON.stringify(favorites));
    updateFavoritesDisplay();
    
    document.querySelectorAll(`[data-id="${imdbID}"] .favorite-btn`).forEach(btn => {
        btn.classList.toggle('active');
    });

    if (updateModal) {
        closeModal();
        updateFavoritesDisplay();
    }
}

function updateFavoritesDisplay() {
    const container = document.getElementById('favoritesGrid');
    
    if (favorites.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-heart"></i>
                <h3>No Favorites Yet</h3>
                <p>Start adding movies to your favorites list</p>
            </div>
        `;
    } else {
        displayMovies(container, favorites);
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        hideSuggestions();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
    }
});

const observerOptions = {
    threshold: 0.5,
    rootMargin: '0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateStats();
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

const statsSection = document.querySelector('.stats');
if (statsSection) {
    observer.observe(statsSection);
}

function animateStats() {
    const stats = [
        { id: 'moviesCount', target: 1000 },
        { id: 'showsCount', target: 500 },
        { id: 'ratingsCount', target: 5000 },
        { id: 'usersCount', target: 10000 }
    ];

    stats.forEach(stat => {
        const element = document.getElementById(stat.id);
        let current = 0;
        const increment = stat.target / 50;
        const timer = setInterval(() => {
            current += increment;
            if (current >= stat.target) {
                element.textContent = stat.target >= 1000 ? `${(stat.target / 1000).toFixed(0)}k+` : `${stat.target}+`;
                clearInterval(timer);
            } else {
                element.textContent = current >= 1000 ? `${(current / 1000).toFixed(1)}k+` : `${Math.floor(current)}+`;
            }
        }, 30);
    });
}

console.log('🎬 CineVerse initialized successfully!');
console.log('💡 Tip: Press Ctrl/Cmd + K to quickly search for movies');
